const pool = require('../config/db');

const crearDisponibilidad = async ({ usuario_id, dia_semana, hora_inicio, hora_fin }) => {
  const q = `
    INSERT INTO disponibilidades (usuario_id, dia_semana, hora_inicio, hora_fin)
    VALUES ($1,$2,$3,$4)
    RETURNING *`;
  const vals = [usuario_id, dia_semana, hora_inicio, hora_fin];
  const res = await pool.query(q, vals);
  return res.rows[0];
};

const obtenerDisponibilidades = async () => {
  const res = await pool.query(
    `SELECT d.id, d.usuario_id, d.dia_semana, d.hora_inicio, d.hora_fin
     FROM disponibilidades d
     ORDER BY d.usuario_id, 
              CASE d.dia_semana
                WHEN 'lunes' THEN 1
                WHEN 'martes' THEN 2
                WHEN 'miércoles' THEN 3
                WHEN 'jueves' THEN 4
                WHEN 'viernes' THEN 5
                WHEN 'sábado' THEN 6
                WHEN 'domingo' THEN 7
              END`
  );
  return res.rows;
};

const eliminarDisponibilidad = async (id) => {
  await pool.query('DELETE FROM disponibilidades WHERE id = $1', [id]);
};

const eliminarTodasDisponibilidades = async () => {
  await pool.query('TRUNCATE disponibilidades RESTART IDENTITY CASCADE');
};

module.exports = {
  crearDisponibilidad,
  obtenerDisponibilidades,
  eliminarDisponibilidad,
  eliminarTodasDisponibilidades
};