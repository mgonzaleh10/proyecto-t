const { 
  crearBeneficio, 
  updateBeneficio, 
  eliminarBeneficio: eliminarBeneficioModel 
} = require('../models/beneficio.model');
const pool = require('../config/db');

// POST   /beneficios
const registrarBeneficio = async (req, res) => {
  try {
    const { id_usuario, tipo, fecha, descripcion } = req.body;
    console.log('🎁 Beneficio recibido:', req.body);
    const beneficio = await crearBeneficio({ usuario_id: id_usuario, tipo, fecha, descripcion });
    res.status(201).json(beneficio);
  } catch (error) {
    console.error('❌ Error al registrar beneficio:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// GET    /beneficios
const obtenerBeneficios = async (_req, res) => {
  try {
    const resultado = await pool.query('SELECT * FROM beneficios');
    res.json(resultado.rows);
  } catch (error) {
    console.error('❌ Error al obtener beneficios:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// PUT    /beneficios/beneficio/:id
const actualizarBeneficio = async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha, descripcion } = req.body;
    const upd = await updateBeneficio(id, { fecha, descripcion });
    res.json(upd);
  } catch (error) {
    console.error('❌ Error al actualizar beneficio:', error);
    res.status(500).json({ error: 'Error al actualizar beneficio' });
  }
};

// DELETE /beneficios/beneficio/:id
const eliminarBeneficio = async (req, res) => {
  try {
    const { id } = req.params;
    await eliminarBeneficioModel(id);
    res.json({ mensaje: 'Beneficio eliminado' });
  } catch (error) {
    console.error('❌ Error al eliminar beneficio:', error);
    res.status(500).json({ error: 'Error al eliminar beneficio' });
  }
};

module.exports = {
  registrarBeneficio,
  obtenerBeneficios,
  actualizarBeneficio,
  eliminarBeneficio
};