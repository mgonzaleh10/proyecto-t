const pool = require('../config/db');

const crearNuevoUsuario = async ({
  nombre,
  correo,
  contrasena,
  rol,
  horas_contrato,
  puede_cerrar
}) => {
  const query = `
    INSERT INTO usuarios
      (nombre, correo, contrasena, rol, horas_contrato, puede_cerrar)
    VALUES
      ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const values = [
    nombre,
    correo,
    contrasena,
    rol,
    horas_contrato,
    puede_cerrar
  ];
  const { rows } = await pool.query(query, values);
  return rows[0];
};

const obtenerUsuarios = async () => {
  const result = await pool.query('SELECT * FROM usuarios ORDER BY id');
  return result.rows;
};

const eliminarUsuarioPorId = async (id) => {
  const result = await pool.query(
    'DELETE FROM usuarios WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0];
};

module.exports = {
  crearNuevoUsuario,
  obtenerUsuarios,
  eliminarUsuarioPorId
};