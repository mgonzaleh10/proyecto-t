const { crearDisponibilidad, obtenerDisponibilidades } = require('../models/disponibilidad.model');

// POST /disponibilidades
const registrarDisponibilidad = async (req, res) => {
  try {
    const { id_usuario, dia, hora_inicio, hora_fin } = req.body;
    console.log("Datos recibidos:", req.body);

    if (!id_usuario || !dia || !hora_inicio || !hora_fin) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const nueva = await crearDisponibilidad({ id_usuario, dia, hora_inicio, hora_fin });
    res.status(201).json(nueva);
  } catch (error) {
    console.error("❌ Error al registrar disponibilidad:", error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// GET /disponibilidades
const listarDisponibilidades = async (req, res) => {
  try {
    const lista = await obtenerDisponibilidades();
    res.json(lista);
  } catch (error) {
    console.error("❌ Error al obtener disponibilidades:", error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = {
  registrarDisponibilidad,
  listarDisponibilidades,
};