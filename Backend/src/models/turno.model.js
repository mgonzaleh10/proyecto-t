const pool = require('../config/db');

const crearTurno = async ({ usuario_id, fecha, hora_inicio, hora_fin, creado_por, observaciones }) => {
  // Inserto un nuevo turno en la tabla turnos
  const q = `INSERT INTO turnos (usuario_id, fecha, hora_inicio, hora_fin, creado_por, observaciones)
             VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`;
  // Preparo los valores para la inserción
  const vals = [usuario_id, fecha, hora_inicio, hora_fin, creado_por, observaciones];
  // Ejecuto la consulta y obtengo el turno creado
  const res = await pool.query(q, vals);
  // Devuelvo el objeto turno
  return res.rows[0];
};

const obtenerTurnos = async () => {
  // Obtengo todos los turnos ordenados por fecha y hora de inicio
  const res = await pool.query('SELECT * FROM turnos ORDER BY fecha, hora_inicio');
  // Devuelvo el arreglo de turnos
  return res.rows;
};

const obtenerTurnosPorUsuario = async (id) => {
  // Obtengo los turnos asociados al usuario indicado
  const res = await pool.query(
    'SELECT * FROM turnos WHERE usuario_id = $1 ORDER BY fecha, hora_inicio',
    [id]
  );
  // Devuelvo los turnos filtrados
  return res.rows;
};

const obtenerTurnosPorFecha = async (fecha) => {
  // Obtengo los turnos programados en la fecha dada
  const res = await pool.query(
    'SELECT * FROM turnos WHERE fecha = $1 ORDER BY hora_inicio',
    [fecha]
  );
  // Devuelvo los turnos para esa fecha
  return res.rows;
};

const updateTurno = async (id, { fecha, hora_inicio, hora_fin, creado_por, observaciones }) => {
  // Actualizo los campos del turno especificado por ID
  const q = `UPDATE turnos
             SET fecha=$1, hora_inicio=$2, hora_fin=$3, creado_por=$4, observaciones=$5
             WHERE id=$6
             RETURNING *`;
  // Preparo los valores para la actualización
  const vals = [fecha, hora_inicio, hora_fin, creado_por, observaciones, id];
  // Ejecuto la actualización y recupero el turno modificado
  const res = await pool.query(q, vals);
  // Devuelvo el turno actualizado
  return res.rows[0];
};

const eliminarTurno = async (id) => {
  // Elimino el turno correspondiente al ID
  await pool.query('DELETE FROM turnos WHERE id = $1', [id]);
};

const eliminarTodosTurnos = async () => {
  // Elimino todos los turnos y reinicio el contador de IDs
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