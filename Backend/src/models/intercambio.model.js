// src/models/intercambio.model.js (CommonJS)
const pool = require('../config/db.js');

class IntercambioModel {
  static async crear({
    turno_origen_id,
    usuario_solicitante,
    usuario_candidato,
    fecha,
    tipo,             // 'swap' | 'cobertura'
    estado = 'pendiente',
  }) {
    const q = `
      INSERT INTO intercambios_turnos
        (turno_origen_id, usuario_solicitante, usuario_candidato, fecha, tipo, estado)
      VALUES ($1,$2,$3,$4,$5,$6)
      RETURNING *;`;
    const { rows } = await pool.query(q, [
      turno_origen_id,
      usuario_solicitante,
      usuario_candidato,
      fecha,
      tipo,
      estado
    ]);
    return rows[0];
  }

  static async actualizarEstado(id, estado, fecha_confirmacion = null) {
    const q = `
      UPDATE intercambios_turnos
         SET estado = $2,
             fecha_confirmacion = COALESCE($3, fecha_confirmacion)
       WHERE id = $1
       RETURNING *;`;
    const { rows } = await pool.query(q, [id, estado, fecha_confirmacion]);
    return rows[0];
  }

  static async listar({ desde = null, hasta = null } = {}) {
    let q = `
      SELECT it.*,
             u1.nombre AS solicitante_nombre,
             u2.nombre AS candidato_nombre
        FROM intercambios_turnos it
        JOIN usuarios u1 ON u1.id = it.usuario_solicitante
        JOIN usuarios u2 ON u2.id = it.usuario_candidato
       WHERE 1=1`;
    const params = [];
    if (desde) { params.push(desde); q += ` AND it.fecha >= $${params.length}`; }
    if (hasta) { params.push(hasta); q += ` AND it.fecha <= $${params.length}`; }
    q += ` ORDER BY it.fecha_creacion DESC`;
    const { rows } = await pool.query(q, params);
    return rows;
  }

  static async obtenerPorId(id) {
    const q = `
      SELECT it.*,
             u1.nombre AS solicitante_nombre,
             u2.nombre AS candidato_nombre
        FROM intercambios_turnos it
        JOIN usuarios u1 ON u1.id = it.usuario_solicitante
        JOIN usuarios u2 ON u2.id = it.usuario_candidato
       WHERE it.id = $1`;
    const { rows } = await pool.query(q, [id]);
    return rows[0];
  }
}

module.exports = { IntercambioModel };
