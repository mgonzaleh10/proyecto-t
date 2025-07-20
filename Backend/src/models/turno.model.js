const pool = require('../config/db');

const crearTurno = async ({ usuario_id, fecha, hora_inicio, hora_fin, creado_por, observaciones }) => {
  const q = `INSERT INTO turnos (usuario_id, fecha, hora_inicio, hora_fin, creado_por, observaciones)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`;
  const vals = [usuario_id, fecha, hora_inicio, hora_fin, creado_por, observaciones];
  const res = await pool.query(q, vals);
  return res.rows[0];
};

const obtenerTurnos = async () => {
  const res = await pool.query('SELECT * FROM turnos ORDER BY fecha, hora_inicio');
  return res.rows;
};

const obtenerTurnosPorUsuario = async (id) => {
  const res = await pool.query(
    'SELECT * FROM turnos WHERE usuario_id = $1 ORDER BY fecha, hora_inicio',
    [id]
  );
  return res.rows;
};

const obtenerTurnosPorFecha = async (fecha) => {
  const res = await pool.query(
    'SELECT * FROM turnos WHERE fecha = $1 ORDER BY hora_inicio',
    [fecha]
  );
  return res.rows;
};

const updateTurno = async (id, { fecha, hora_inicio, hora_fin, creado_por, observaciones }) => {
  const q = `UPDATE turnos
             SET fecha=$1, hora_inicio=$2, hora_fin=$3, creado_por=$4, observaciones=$5
             WHERE id=$6
             RETURNING *`;
  const vals = [fecha, hora_inicio, hora_fin, creado_por, observaciones, id];
  const res = await pool.query(q, vals);
  return res.rows[0];
};

const eliminarTurno = async (id) => {
  await pool.query('DELETE FROM turnos WHERE id = $1', [id]);
};

const eliminarTodosTurnos = async () => {
  await pool.query('TRUNCATE turnos RESTART IDENTITY CASCADE');
};

module.exports = {
  crearTurno,
  obtenerTurnos,
  obtenerTurnosPorUsuario,
  obtenerTurnosPorFecha,
  updateTurno,
  eliminarTurno,
  eliminarTodosTurnos
};