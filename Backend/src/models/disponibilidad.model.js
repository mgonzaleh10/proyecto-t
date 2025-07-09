const pool = require('../config/db');

// Insertar una nueva disponibilidad
const crearDisponibilidad = async ({ id_usuario, dia, hora_inicio, hora_fin }) => {
  const query = `
    INSERT INTO disponibilidades (usuario_id, dia_semana, hora_inicio, hora_fin)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const values = [id_usuario, dia.toLowerCase(), hora_inicio, hora_fin];
  const { rows } = await pool.query(query, values);
  return rows[0];
};

// Obtener todas las disponibilidades
const obtenerDisponibilidades = async () => {
  const { rows } = await pool.query('SELECT * FROM disponibilidades');
  return rows;
};

module.exports = {
  crearDisponibilidad,
  obtenerDisponibilidades,
};