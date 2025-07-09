const { crearBeneficio } = require('../models/beneficio.model');

const registrarBeneficio = async (req, res) => {
    try {
        const { id_usuario, tipo, fecha, descripcion } = req.body;
        console.log('🎁 Beneficio recibido:', req.body);

        const beneficio = await crearBeneficio({ id_usuario, tipo, fecha, descripcion });

        res.status(201).json(beneficio);
    } catch (error) {
        console.error('❌ Error al registrar beneficio:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

const pool = require('../config/db');

const obtenerBeneficios = async (req, res) => {
    try {
        const resultado = await pool.query('SELECT * FROM beneficios');
        res.json(resultado.rows);
    } catch (error) {
        console.error('❌ Error al obtener beneficios:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

module.exports = {
    registrarBeneficio,
    obtenerBeneficios
};