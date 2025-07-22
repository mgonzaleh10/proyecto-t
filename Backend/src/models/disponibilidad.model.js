const pool = require('../config/db');

const crearDisponibilidad = async ({ usuario_id, dia_semana, hora_inicio, hora_fin }) => {
  // Inserto una nueva disponibilidad para el usuario
  const q = `
    INSERT INTO disponibilidades (usuario_id, dia_semana, hora_inicio, hora_fin)
    VALUES ($1,$2,$3,$4)
    RETURNING *`;
  // Preparo los valores para la inserción
  const vals = [usuario_id, dia_semana, hora_inicio, hora_fin];
  // Ejecuto la inserción y recupero la fila creada
  const res = await pool.query(q, vals);
  // Devuelvo la disponibilidad recién creada
  return res.rows[0];
};

const obtenerDisponibilidades = async () => {
  // Obtengo todas las disponibilidades ordenadas por usuario y día de la semana
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
  // Devuelvo el arreglo de disponibilidades
  return res.rows;
};

const eliminarDisponibilidad = async (id) => {
  // Elimino la disponibilidad correspondiente al ID dado
  await pool.query('DELETE FROM disponibilidades WHERE id = $1', [id]);
};

const eliminarTodasDisponibilidades = async () => {
  // Elimino todas las disponibilidades y reinicio el contador de IDs
  await pool.query('TRUNCATE disponibilidades RESTART IDENTITY CASCADE');
};

module.exports = {
  crearDisponibilidad,
  obtenerDisponibilidades,
  eliminarDisponibilidad,
  eliminarTodasDisponibilidades
};