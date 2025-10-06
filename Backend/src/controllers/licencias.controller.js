const {
  crearLicencia,
  obtenerLicencias,
  obtenerLicenciasPorUsuario,
  eliminarLicencia,
} = require('../models/licencia.model');

// Crear nueva licencia
const registrarLicencia = async (req, res) => {
  try {
    const { usuario_id, fecha_inicio, fecha_fin } = req.body;
    const licencia = await crearLicencia({ usuario_id, fecha_inicio, fecha_fin });
    res.json(licencia);
  } catch (error) {
    console.error('❌ Error al registrar licencia:', error);
    res.status(500).json({ error: 'Error al registrar licencia' });
  }
};

// Listar todas las licencias
const listarLicencias = async (req, res) => {
  try {
    const licencias = await obtenerLicencias();
    res.json(licencias);
  } catch (error) {
    console.error('❌ Error al listar licencias:', error);
    res.status(500).json({ error: 'Error al listar licencias' });
  }
};

// Listar por usuario
const listarLicenciasPorUsuario = async (req, res) => {
  try {
    const { usuario_id } = req.params;
    const licencias = await obtenerLicenciasPorUsuario(usuario_id);
    res.json(licencias);
  } catch (error) {
    console.error('❌ Error al obtener licencias del usuario:', error);
    res.status(500).json({ error: 'Error al obtener licencias' });
  }
};

// Eliminar licencia
const borrarLicencia = async (req, res) => {
  try {
    const { id } = req.params;
    const licencia = await eliminarLicencia(id);
    res.json(licencia);
  } catch (error) {
    console.error('❌ Error al eliminar licencia:', error);
    res.status(500).json({ error: 'Error al eliminar licencia' });
  }
};

module.exports = {
  registrarLicencia,
  listarLicencias,
  listarLicenciasPorUsuario,
  borrarLicencia
};
