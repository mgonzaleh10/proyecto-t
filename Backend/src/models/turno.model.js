const pool = require('../config/db');

async function crearTurno({ usuario_id, fecha, hora_inicio, hora_fin, creado_por, observaciones }) {
  const q = `
    INSERT INTO turnos
      (usuario_id, fecha, hora_inicio, hora_fin, creado_por, observaciones)
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING *
  `;
  const vals = [usuario_id, fecha, hora_inicio, hora_fin, creado_por, observaciones];
  const res = await pool.query(q, vals);
  return res.rows[0];
}

async function obtenerTurnos() {
  const res = await pool.query(`
    SELECT * FROM turnos
    ORDER BY fecha, hora_inicio
  `);
  return res.rows;
}

async function obtenerTurnosPorUsuario(id) {
  const res = await pool.query(
    `SELECT * FROM turnos
     WHERE usuario_id = $1
     ORDER BY fecha, hora_inicio`,
    [id]
  );
  return res.rows;
}

async function obtenerTurnosPorFecha(fecha) {
  const res = await pool.query(
    `SELECT * FROM turnos
     WHERE fecha = $1
     ORDER BY hora_inicio`,
    [fecha]
  );
  return res.rows;
}

async function eliminarTurnoPorId(id) {
  await pool.query(`DELETE FROM turnos WHERE id = $1`, [id]);
}

async function eliminarTodosTurnos() {
  await pool.query(`TRUNCATE turnos RESTART IDENTITY CASCADE`);
}

/**
 * Actualiza un turno por su ID y devuelve la fila actualizada
 */
async function actualizarTurnoPorId(id, { fecha, hora_inicio, hora_fin, observaciones }) {
  const q = `
    UPDATE turnos
    SET fecha        = $1,
        hora_inicio  = $2,
        hora_fin     = $3,
        observaciones= $4
    WHERE id = $5
    RETURNING *
  `;
  const vals = [fecha, hora_inicio, hora_fin, observaciones || '', id];
  const res = await pool.query(q, vals);
  return res.rows[0];
}

module.exports = {
  crearTurno,
  obtenerTurnos,
  obtenerTurnosPorUsuario,
  obtenerTurnosPorFecha,
  eliminarTurnoPorId,
  eliminarTodosTurnos,
  actualizarTurnoPorId
};