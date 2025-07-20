const {
  crearDisponibilidad: crearModel,
  obtenerDisponibilidades,
  eliminarDisponibilidad: eliminarModel,
  eliminarTodasDisponibilidades
} = require('../models/disponibilidad.model');

// POST /disponibilidades
// acepta un solo objeto o un array de objetos
const crearDisponibilidad = async (req, res) => {
  try {
    const toInsert = Array.isArray(req.body) ? req.body : [req.body];
    const created = [];
    for (const item of toInsert) {
      const { usuario_id, dia_semana, hora_inicio, hora_fin } = item;
      if (!usuario_id || !dia_semana || !hora_inicio || !hora_fin) continue;
      const nuevo = await crearModel({ usuario_id, dia_semana, hora_inicio, hora_fin });
      created.push(nuevo);
    }
    if (!created.length) {
      return res.status(400).json({ error: 'No se creó ninguna disponibilidad válida.' });
    }
    res.status(201).json(created);
  } catch (error) {
    console.error('❌ Error al crear disponibilidad:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// GET /disponibilidades
const listarDisponibilidades = async (req, res) => {
  try {
    const all = await obtenerDisponibilidades();
    res.json(all);
  } catch (error) {
    console.error('❌ Error al obtener disponibilidades:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// DELETE /disponibilidades/:id
const eliminarDisponibilidad = async (req, res) => {
  try {
    const { id } = req.params;
    await eliminarModel(id);
    res.json({ mensaje: 'Disponibilidad eliminada correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar disponibilidad:', error);
    res.status(500).json({ error: 'Error del servidor al eliminar disponibilidad' });
  }
};

// DELETE /disponibilidades
const eliminarTodas = async (req, res) => {
  try {
    await eliminarTodasDisponibilidades();
    res.json({ mensaje: 'Todas las disponibilidades eliminadas correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar todas las disponibilidades:', error);
    res.status(500).json({ error: 'Error del servidor al eliminar todas las disponibilidades' });
  }
};

module.exports = {
  crearDisponibilidad,
  listarDisponibilidades,
  eliminarDisponibilidad,
  eliminarTodas
};