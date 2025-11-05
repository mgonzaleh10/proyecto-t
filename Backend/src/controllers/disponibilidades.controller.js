// src/controllers/disponibilidades.controller.js
const {
  crearDisponibilidad: crearModel,
  obtenerDisponibilidades,
  eliminarDisponibilidad: eliminarModel,
  eliminarTodasDisponibilidades
} = require('../models/disponibilidad.model');

const { syncDisponibilidadesSheet } = require('../services/excelDisponibilidades');

// POST /disponibilidades  (acepta objeto único o array)
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

    // 🔄 IMPORTANTE: esperar a la sincronización
    try {
      await syncDisponibilidadesSheet();
    } catch (err) {
      console.error('Excel sync (disponibilidades - crear) falló:', err);
    }

    res.status(201).json(created);
  } catch (error) {
    console.error('❌ Error al crear disponibilidad:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// GET /disponibilidades
const listarDisponibilidades = async (_req, res) => {
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

    // 🔄 IMPORTANTE: esperar a la sincronización
    try {
      await syncDisponibilidadesSheet();
    } catch (err) {
      console.error('Excel sync (disponibilidades - delete) falló:', err);
    }

    res.json({ mensaje: 'Disponibilidad eliminada correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar disponibilidad:', error);
    res.status(500).json({ error: 'Error del servidor al eliminar disponibilidad' });
  }
};

// DELETE /disponibilidades
const eliminarTodas = async (_req, res) => {
  try {
    await eliminarTodasDisponibilidades();

    // 🔄 IMPORTANTE: esperar a la sincronización
    try {
      await syncDisponibilidadesSheet();
    } catch (err) {
      console.error('Excel sync (disponibilidades - delete all) falló:', err);
    }

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
