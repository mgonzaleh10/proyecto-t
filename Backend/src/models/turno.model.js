const pool = require('../config/db');

// Crear un turno
async function crearTurno({ usuario_id, fecha, hora_inicio, hora_fin, creado_por, observaciones }) {
    const query = `
        INSERT INTO turnos (usuario_id, fecha, hora_inicio, hora_fin, creado_por, observaciones)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
    `;
    const values = [usuario_id, fecha, hora_inicio, hora_fin, creado_por, observaciones];
    const result = await pool.query(query, values);
    return result.rows[0];
}

// Obtener todos los turnos
async function obtenerTurnos() {
    const result = await pool.query('SELECT * FROM turnos ORDER BY fecha, hora_inicio');
    return result.rows;
}

// Obtener turnos por usuario
async function obtenerTurnosPorUsuario(id_usuario) {
    const result = await pool.query('SELECT * FROM turnos WHERE usuario_id = $1', [id_usuario]);
    return result.rows;
}

async function obtenerTurnosPorFecha(fecha) {
  const result = await pool.query(
    'SELECT * FROM turnos WHERE fecha = $1 ORDER BY hora_inicio',
    [fecha]
  );
  return result.rows;
}

module.exports = {
    crearTurno,
    obtenerTurnos,
    obtenerTurnosPorUsuario,
    obtenerTurnosPorFecha
};