const pool = require('../config/db');

/**
 * Crea un nuevo beneficio.
 * @param {Object} params
 * @param {number} params.usuario_id
 * @param {string} params.tipo
 * @param {string} params.fecha        // 'YYYY-MM-DD'
 * @param {string} [params.descripcion]
 */
async function crearBeneficio({ usuario_id, tipo, fecha, descripcion }) {
  const query = `
    INSERT INTO beneficios (usuario_id, tipo, fecha, descripcion)
    VALUES ($1, $2, $3, $4)
    RETURNING *;
  `;
  const valores = [usuario_id, tipo, fecha, descripcion];
  const { rows } = await pool.query(query, valores);
  return rows[0];
}

/**
 * Actualiza un beneficio existente.
 * @param {number} id
 * @param {Object} data
 * @param {string} data.fecha
 * @param {string} [data.descripcion]
 */
async function updateBeneficio(id, { fecha, descripcion }) {
  const query = `
    UPDATE beneficios
       SET fecha       = $1,
           descripcion = $2
     WHERE id = $3
    RETURNING *;
  `;
  const valores = [fecha, descripcion, id];
  const { rows } = await pool.query(query, valores);
  return rows[0];
}

/**
 * Elimina un beneficio por su ID.
 * @param {number} id
 */
async function eliminarBeneficio(id) {
  await pool.query(
    `DELETE FROM beneficios WHERE id = $1`,
    [id]
  );
}

module.exports = {
  crearBeneficio,
  updateBeneficio,
  eliminarBeneficio
};