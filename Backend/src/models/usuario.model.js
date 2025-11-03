const pool = require('../config/db');

async function crearNuevoUsuario({
  nombre,
  correo,
  contrasena,
  rol,
  horas_contrato,
  puede_cerrar
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Insertar con el primer ID “libre” (rellena huecos)
    const insertSql = `
      WITH seq AS (
        SELECT generate_series(1, COALESCE((SELECT MAX(id) FROM usuarios),0) + 1) AS id
      ),
      free AS (
        SELECT id FROM seq
        EXCEPT
        SELECT id FROM usuarios
        ORDER BY id
        LIMIT 1
      )
      INSERT INTO usuarios (id, nombre, correo, contrasena, rol, horas_contrato, puede_cerrar)
      VALUES ((SELECT id FROM free), $1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const params = [nombre, correo, contrasena, rol, horas_contrato, !!puede_cerrar];
    const { rows } = await client.query(insertSql, params);
    const usuario = rows[0];

    // 2) Ajustar la secuencia para que el próximo nextval no choque
    //    (esto no cambia el ID del usuario recién insertado)
    await client.query(`
      SELECT setval(
        pg_get_serial_sequence('usuarios','id'),
        COALESCE((SELECT MAX(id) FROM usuarios), 0)
      );
    `);

    await client.query('COMMIT');
    return usuario;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

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