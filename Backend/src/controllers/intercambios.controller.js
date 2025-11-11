// src/controllers/intercambios.controller.js (CommonJS)
const pool = require('../config/db.js');
const { IntercambioModel } = require('../models/intercambio.model.js');
const { recomendarIntercambioService } = require('../services/recomendacionesHorarios.js');

/**
 * POST /intercambios/recomendar
 * Body: { usuario_id, turno_id?, fecha, hora_inicio, hora_fin }
 */
async function recomendarIntercambio(req, res) {
  try {
    const { usuario_id, turno_id, fecha, hora_inicio, hora_fin } = req.body || {};
    if (!usuario_id || !fecha || !hora_inicio || !hora_fin) {
      return res
        .status(400)
        .json({ error: 'Faltan parámetros: usuario_id, fecha, hora_inicio, hora_fin.' });
    }

    const data = await recomendarIntercambioService({
      usuarioId: Number(usuario_id),
      turnoOrigenId: turno_id ? Number(turno_id) : null,
      fecha,
      hora_inicio,
      hora_fin
    });

    return res.json(data);
  } catch (err) {
    console.error('[recomendarIntercambio]', err);
    return res.status(500).json({ error: 'Error al calcular recomendaciones.' });
  }
}

/**
 * POST /intercambios/confirmar
 * Body:
 *   tipo: 'swap'|'cobertura'
 *   turno_origen_id?: number
 *   usuario_solicitante: number  (A)
 *   usuario_candidato: number    (B)
 *   fecha: YYYY-MM-DD
 *   hora_inicio?: HH:MM (requerido si no viene turno_origen_id)
 *   hora_fin?:    HH:MM (requerido si no viene turno_origen_id)
 *   turno_destino_id?: number (obligatorio si tipo==='swap')
 *
 * Comportamiento:
 *   - swap: intercambia dueños de turno A y turno_destino_id.
 *   - cobertura: reasigna el turno de A a B **y si B ya tenía otro turno ese mismo día,
 *                ese turno de B se reasigna a A (reemplazo mismo día)**.
 */
async function confirmarIntercambio(req, res) {
  const client = await pool.connect();
  let resultadoRespuesta = null; // lo devolvemos al final
  try {
    let {
      tipo,
      turno_origen_id,
      usuario_solicitante,
      usuario_candidato,
      fecha,
      hora_inicio = null,
      hora_fin = null,
      turno_destino_id = null
    } = req.body || {};

    // Normalización
    tipo = (tipo || '').toLowerCase();
    usuario_solicitante = Number(usuario_solicitante);
    usuario_candidato = Number(usuario_candidato);
    turno_origen_id = turno_origen_id ? Number(turno_origen_id) : null;
    turno_destino_id = turno_destino_id ? Number(turno_destino_id) : null;

    // Validaciones
    if (!tipo || !['swap', 'cobertura'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido. Debe ser "swap" o "cobertura".' });
    }
    if (!usuario_solicitante || !usuario_candidato || !fecha) {
      return res
        .status(400)
        .json({ error: 'Faltan campos: usuario_solicitante, usuario_candidato, fecha.' });
    }
    if (!turno_origen_id && (!hora_inicio || !hora_fin)) {
      return res
        .status(400)
        .json({ error: 'Si no envías turno_origen_id, debes enviar hora_inicio y hora_fin.' });
    }
    if (tipo === 'swap' && !turno_destino_id) {
      return res.status(400).json({ error: 'Para "swap" es obligatorio turno_destino_id.' });
    }

    // ================== TRANSACCIÓN: sólo mutaciones de turnos ==================
    await client.query('BEGIN');

    // 1) localizar turno A
    let turnoA;
    if (turno_origen_id) {
      const { rows } = await client.query(
        'SELECT * FROM turnos WHERE id = $1 FOR UPDATE',
        [turno_origen_id]
      );
      if (rows.length === 0) throw new Error('Turno origen no existe.');
      turnoA = rows[0];
    } else {
      const { rows } = await client.query(
        `SELECT * FROM turnos
           WHERE usuario_id = $1 AND fecha = $2
             AND hora_inicio = $3::time AND hora_fin = $4::time
         ORDER BY id ASC
           FOR UPDATE`,
        [usuario_solicitante, fecha, hora_inicio, hora_fin]
      );
      if (rows.length === 0) throw new Error('No se encontró el turno de origen por fecha y horario.');
      turnoA = rows[0];
    }

    if (tipo === 'swap') {
      // 2) localizar turno B
      const { rows: rowsB } = await client.query(
        'SELECT * FROM turnos WHERE id = $1 FOR UPDATE',
        [turno_destino_id]
      );
      if (rowsB.length === 0) throw new Error('Turno destino no existe.');
      const turnoB = rowsB[0];

      if (turnoA.id === turnoB.id) throw new Error('No puedes intercambiar el mismo turno.');

      // 3) intercambiar propietarios
      const upA = await client.query(
        'UPDATE turnos SET usuario_id = $1 WHERE id = $2 RETURNING *',
        [usuario_candidato, turnoA.id]
      );
      if (upA.rowCount === 0) throw new Error('No se actualizó turno A.');

      const upB = await client.query(
        'UPDATE turnos SET usuario_id = $1 WHERE id = $2 RETURNING *',
        [usuario_solicitante, turnoB.id]
      );
      if (upB.rowCount === 0) throw new Error('No se actualizó turno B.');

      resultadoRespuesta = {
        ok: true,
        turnos_actualizados: { A: upA.rows[0], B: upB.rows[0] },
        tipo: 'swap',
        fecha,
        turno_origen_id: turnoA.id,
        turno_destino_id: turnoB.id
      };
    } else {
      // === Cobertura con posible reemplazo el mismo día ===
      const upCob = await client.query(
        'UPDATE turnos SET usuario_id = $1 WHERE id = $2 RETURNING *',
        [usuario_candidato, turnoA.id]
      );
      if (upCob.rowCount === 0) throw new Error('No se actualizó el turno en cobertura.');
      const turnoA_reasignado = upCob.rows[0];

      const { rows: turnosB_mismoDia } = await client.query(
        `SELECT * FROM turnos
           WHERE usuario_id = $1 AND fecha = $2 AND id <> $3
         ORDER BY hora_inicio ASC
           FOR UPDATE`,
        [usuario_candidato, fecha, turnoA.id]
      );

      let turnoB_reemplazado = null;
      if (turnosB_mismoDia.length > 0) {
        const target = turnosB_mismoDia[0];
        const upd = await client.query(
          'UPDATE turnos SET usuario_id = $1 WHERE id = $2 RETURNING *',
          [usuario_solicitante, target.id]
        );
        if (upd.rowCount === 0) throw new Error('No se actualizó el turno de reemplazo.');
        turnoB_reemplazado = upd.rows[0];
      }

      resultadoRespuesta = {
        ok: true,
        tipo: 'cobertura',
        fecha,
        turno_origen_id: turnoA.id,
        resultado: {
          turnoA_reasignado,
          turnoB_reemplazado
        }
      };
    }

    // 4) confirmamos las mutaciones de turnos
    await client.query('COMMIT');
    // ================== FIN TRANSACCIÓN ==================

    // 5) Registramos el historial fuera de la transacción (best-effort)
    try {
      if (resultadoRespuesta.tipo === 'swap') {
        await IntercambioModel.crear({
          turno_origen_id: resultadoRespuesta.turno_origen_id,
          usuario_solicitante,
          usuario_candidato,
          fecha,
          tipo: 'swap',
          estado: 'confirmado',
          turno_destino_id: resultadoRespuesta.turno_destino_id
        });
      } else {
        await IntercambioModel.crear({
          turno_origen_id: resultadoRespuesta.turno_origen_id,
          usuario_solicitante,
          usuario_candidato,
          fecha,
          tipo: 'cobertura',
          estado: 'confirmado',
          turno_destino_id: null
        });
      }
    } catch (e) {
      // No rompemos la operación si el log falla
      console.warn('[confirmarIntercambio] Registro de historial falló (no crítico):', e.message);
    }

    return res.json(resultadoRespuesta);
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[confirmarIntercambio]', err);
    return res
      .status(500)
      .json({ error: err.message || 'No se pudo confirmar el intercambio/cobertura.' });
  } finally {
    client.release();
  }
}

/**
 * GET /intercambios/historial
 * Query opcionales: ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 */
async function listarIntercambios(req, res) {
  try {
    const { desde, hasta } = req.query || {};
    const list = await IntercambioModel.listar({ desde, hasta });
    return res.json(list);
  } catch (err) {
    console.error('[listarIntercambios]', err);
    return res.status(500).json({ error: 'Error al obtener historial de intercambios.' });
  }
}

module.exports = {
  recomendarIntercambio,
  confirmarIntercambio,
  listarIntercambios,
};
