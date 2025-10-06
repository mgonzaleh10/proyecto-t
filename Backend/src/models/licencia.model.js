const pool = require('../config/db');

// Crear licencia
async function crearLicencia({ usuario_id, fecha_inicio, fecha_fin }) {
  const result = await pool.query(
    `INSERT INTO licencias (usuario_id, fecha_inicio, fecha_fin)
     VALUES ($1, $2, $3) RETURNING *`,
    [usuario_id, fecha_inicio, fecha_fin]
  );
  return result.rows[0];
}

// Obtener todas las licencias
async function obtenerLicencias() {
  const result = await pool.query('SELECT * FROM licencias');
  return result.rows;
}

// Obtener licencias por usuario
async function obtenerLicenciasPorUsuario(usuario_id) {
  const result = await pool.query(
    'SELECT * FROM licencias WHERE usuario_id = $1',
    [usuario_id]
  );
  return result.rows;
}

// Eliminar licencia
async function eliminarLicencia(id) {
  const result = await pool.query(
    'DELETE FROM licencias WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0];
}

// ¿El usuario tiene licencia vigente en esa fecha?
async function tieneLicenciaEnFecha(usuario_id, fecha /* 'YYYY-MM-DD' */) {
  const q = `
    SELECT 1
    FROM licencias
    WHERE usuario_id = $1
      AND fecha_inicio <= $2::date
      AND fecha_fin    >= $2::date
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [usuario_id, fecha]);
  return rows.length > 0;
}

// Licencias por usuario en un rango (útil para generadores)
async function obtenerLicenciasEnRango(usuario_id, fecha_inicio, fecha_fin) {
  const q = `
    SELECT *
    FROM licencias
    WHERE usuario_id = $1
      AND fecha_inicio <= $3::date
      AND fecha_fin    >= $2::date
    ORDER BY fecha_inicio
  `;
  const { rows } = await pool.query(q, [usuario_id, fecha_inicio, fecha_fin]);
  return rows;
}


module.exports = {
  crearLicencia,
  obtenerLicencias,
  obtenerLicenciasPorUsuario,
  eliminarLicencia,
  tieneLicenciaEnFecha,
  obtenerLicenciasEnRango
};
