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

// ✨ MODIFICACIÓN: al eliminar un usuario, primero borramos todas sus filas relacionadas
const eliminarUsuarioPorId = async (id) => {
  // 1) Borro disponibilidades del usuario
  await pool.query('DELETE FROM disponibilidades WHERE usuario_id = $1', [id]);
  // 2) Borro beneficios del usuario
  await pool.query('DELETE FROM beneficios WHERE usuario_id = $1', [id]);
  // 3) Borro turnos del usuario
  await pool.query('DELETE FROM turnos WHERE usuario_id = $1', [id]);
  // 4) Finalmente, elimino el usuario
  const result = await pool.query(
    'DELETE FROM usuarios WHERE id = $1 RETURNING *',
    [id]
  );
  return result.rows[0];
};

// Nuevo: actualizo usuario existente
const actualizarUsuario = async (
  id,
  { nombre, correo, contrasena, rol, horas_contrato, puede_cerrar }
) => {
  const query = `
    UPDATE usuarios
    SET nombre = $1,
        correo = $2,
        contrasena = $3,
        rol = $4,
        horas_contrato = $5,
        puede_cerrar = $6
    WHERE id = $7
    RETURNING *;
  `;
  const values = [
    nombre,
    correo,
    contrasena,
    rol,
    horas_contrato,
    puede_cerrar,
    id
  ];
  const { rows } = await pool.query(query, values);
  return rows[0];
};


module.exports = {
  crearNuevoUsuario,
  obtenerUsuarios,
  eliminarUsuarioPorId,
  actualizarUsuario  // exporto la nueva función
};