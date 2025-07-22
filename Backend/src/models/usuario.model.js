const pool = require('../config/db');

const crearNuevoUsuario = async ({
  nombre,
  correo,
  contrasena,
  rol,
  horas_contrato,
  puede_cerrar
}) => {
  // Inserto un nuevo usuario en la tabla usuarios
  const query = `
    INSERT INTO usuarios
      (nombre, correo, contrasena, rol, horas_contrato, puede_cerrar)
    VALUES
      ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  // Preparo los valores para la consulta
  const values = [
    nombre,
    correo,
    contrasena,
    rol,
    horas_contrato,
    puede_cerrar
  ];
  // Ejecuto la inserción y obtengo el usuario creado
  const { rows } = await pool.query(query, values);
  // Devuelvo el usuario recién creado
  return rows[0];
};

const obtenerUsuarios = async () => {
  // Obtengo todos los usuarios ordenados por su ID
  const result = await pool.query('SELECT * FROM usuarios ORDER BY id');
  // Devuelvo el arreglo de usuarios
  return result.rows;
};

const eliminarUsuarioPorId = async (id) => {
  // Elimino al usuario con el ID especificado y retorno el registro eliminado
  const result = await pool.query(
    'DELETE FROM usuarios WHERE id = $1 RETURNING *',
    [id]
  );
  // Devuelvo el usuario eliminado o undefined si no existía
  return result.rows[0];
};

module.exports = {
  crearNuevoUsuario,
  obtenerUsuarios,
  eliminarUsuarioPorId
};