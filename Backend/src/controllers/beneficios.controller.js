const { crearBeneficio } = require('../models/beneficio.model');  // Importo función para crear un beneficio en BD

const registrarBeneficio = async (req, res) => {
    try {
        const { id_usuario, tipo, fecha, descripcion } = req.body;  // Desestructuro datos entrantes
        console.log('🎁 Beneficio recibido:', req.body);           // Log para depuración

        const beneficio = await crearBeneficio({ id_usuario, tipo, fecha, descripcion });  // Creo el registro

        res.status(201).json(beneficio);  // Devuelvo el nuevo beneficio con código 201
    } catch (error) {
        console.error('❌ Error al registrar beneficio:', error);
        res.status(500).json({ error: 'Error del servidor' });  // Manejo de error genérico
    }
};

const pool = require('../config/db');  // Importo la conexión a la BD

const obtenerBeneficios = async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM beneficios');  // Consulto todos los beneficios
        res.json(resultado.rows);  // Devuelvo array de filas
    } catch (error) {
        console.error('❌ Error al obtener beneficios:', error);
        res.status(500).json({ error: 'Error del servidor' });  // Error de servidor
    }
};

module.exports = {
    registrarBeneficio,  // Exporto controlador para POST
    obtenerBeneficios    // Exporto controlador para GET
};