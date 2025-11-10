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
      return res.status(400).json({ error: 'Faltan parámetros: usuario_id, fecha, hora_inicio, hora_fin.' });
    }
    const data = await recomendarIntercambioService({
      usuarioId: Number(usuario_id),
      turnoOrigenId: turno_id || null,
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
  try {
    const {
      tipo,
      turno_origen_id,
      usuario_solicitante,
      usuario_candidato,
      fecha,
      hora_inicio = null,
      hora_fin = null,
      turno_destino_id = null
    } = req.body || {};

    if (!tipo || !usuario_solicitante || !usuario_candidato || !fecha) {
      return res.status(400).json({ error: 'Faltan campos obligatorios: tipo, usuario_solicitante, usuario_candidato, fecha.' });
    }
    if (!['swap', 'cobertura'].includes(tipo)) {
      return res.status(400).json({ error: 'Tipo inválido. Debe ser "swap" o "cobertura".' });
    }
    if (!turno_origen_id && (!hora_inicio || !hora_fin)) {
      return res.status(400).json({ error: 'Si no envías turno_origen_id, debes enviar hora_inicio y hora_fin.' });
    }
    if (tipo === 'swap' && !turno_destino_id) {
      return res.status(400).json({ error: 'Para "swap" es obligatorio turno_destino_id.' });
    }

    await client.query('BEGIN');

    // --- localizar turno A (origen) con FOR UPDATE ---
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
      // Turno B (destino) a intercambiar
      const { rows: rowsB } = await client.query(
        'SELECT * FROM turnos WHERE id = $1 FOR UPDATE',
        [turno_destino_id]
      );
      if (rowsB.length === 0) throw new Error('Turno destino no existe.');
      const turnoB = rowsB[0];

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

      const registro = await IntercambioModel.crear({
        turno_origen_id: turnoA.id,
        usuario_solicitante,
        usuario_candidato,
        fecha,
        tipo: 'swap',
        estado: 'confirmado',
        turno_destino_id: turnoB.id
      });

      await client.query('COMMIT');
      return res.json({
        ok: true,
        intercambio: registro,
        turnos_actualizados: { A: upA.rows[0], B: upB.rows[0] }
      });
    }

    // === COBERTURA CON REEMPLAZO MISMO DÍA ===
    // 1) Reasigna turno de A a B
    const upCob = await client.query(
      'UPDATE turnos SET usuario_id = $1 WHERE id = $2 RETURNING *',
      [usuario_candidato, turnoA.id]
    );
    if (upCob.rowCount === 0) throw new Error('No se actualizó el turno en cobertura.');
    const turnoA_reasignado = upCob.rows[0];

    // 2) Si B ya tenía otro turno ese mismo día (distinto de turnoA), lo pasamos a A
    const { rows: turnosB_mismoDia } = await client.query(
      `SELECT * FROM turnos
         WHERE usuario_id = $1 AND fecha = $2 AND id <> $3
       ORDER BY id ASC
         FOR UPDATE`,
      [usuario_candidato, fecha, turnoA.id]
    );

    let turnoB_reemplazado = null;
    if (turnosB_mismoDia.length > 0) {
      // elegimos el primero (más antiguo). Podrías aquí elegir por solapamiento/duración si quisieras.
      const target = turnosB_mismoDia[0];
      const upd = await client.query(
        'UPDATE turnos SET usuario_id = $1 WHERE id = $2 RETURNING *',
        [usuario_solicitante, target.id]
      );
      if (upd.rowCount === 0) throw new Error('No se actualizó el turno de reemplazo.');
      turnoB_reemplazado = upd.rows[0];
    }

    // 3) Registrar intercambio (como cobertura)
    const registro = await IntercambioModel.crear({
      turno_origen_id: turnoA.id,
      usuario_solicitante,
      usuario_candidato,
      fecha,
      tipo: 'cobertura',
      estado: 'confirmado',
      turno_destino_id: null
    });

    await client.query('COMMIT');
    return res.json({
      ok: true,
      intercambio: registro,
      resultado: {
        turnoA_reasignado,
        turnoB_reemplazado // puede ser null si B no tenía turno ese día
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[confirmarIntercambio]', err);
    return res.status(500).json({ error: 'No se pudo confirmar el intercambio/cobertura.' });
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
