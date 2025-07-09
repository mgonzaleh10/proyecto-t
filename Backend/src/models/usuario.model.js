const pool = require('../config/db');

const crearNuevoUsuario = async ({ nombre, correo, contrasena, rol }) => {
    const query = `
        INSERT INTO usuarios (nombre, correo, contrasena, rol)
        VALUES ($1, $2, $3, $4)
    `;
    const values = [nombre, correo, contrasena, rol];
    await pool.query(query, values);
};

const obtenerUsuarios = async () => {
    const resultado = await pool.query('SELECT * FROM usuarios');
    return resultado.rows;
};

module.exports = {
    crearNuevoUsuario,
    obtenerUsuarios
};