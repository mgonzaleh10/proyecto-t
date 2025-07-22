const pool = require('../config/db');

const crearBeneficio = async ({ id_usuario, tipo, fecha, descripcion }) => {
    // Inserto un registro en la tabla beneficios
    const query = `
        INSERT INTO beneficios (usuario_id, tipo, fecha, descripcion)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
    `;
    // Preparo los valores para la consulta
    const valores = [id_usuario, tipo, fecha, descripcion];
    // Ejecuto la consulta y recupero el beneficio creado
    const resultado = await pool.query(query, valores);
    // Devuelvo el primer registro insertado
    return resultado.rows[0];
};

module.exports = {
    crearBeneficio
};