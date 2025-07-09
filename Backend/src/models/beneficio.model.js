const pool = require('../config/db');

const crearBeneficio = async ({ id_usuario, tipo, fecha, descripcion }) => {
    const query = `
        INSERT INTO beneficios (usuario_id, tipo, fecha, descripcion)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
    `;
    const valores = [id_usuario, tipo, fecha, descripcion];
    const resultado = await pool.query(query, valores);
    return resultado.rows[0];
};

module.exports = {
    crearBeneficio
};