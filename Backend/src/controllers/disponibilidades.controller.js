const {
  crearDisponibilidad: crearModel,                 // Alias para función de creación
  obtenerDisponibilidades,                         // Función para listar todas
  eliminarDisponibilidad: eliminarModel,           // Alias para función de eliminación por ID
  eliminarTodasDisponibilidades                    // Función para eliminar todo
} = require('../models/disponibilidad.model');

// POST /disponibilidades
// Acepto objeto único o arreglo de objetos
const crearDisponibilidad = async (req, res) => {
  try {
    const toInsert = Array.isArray(req.body) ? req.body : [req.body];  // Normalizo a arreglo
    const created = [];

    for (const item of toInsert) {
      const { usuario_id, dia_semana, hora_inicio, hora_fin } = item;  // Desestructuro cada item
      if (!usuario_id || !dia_semana || !hora_inicio || !hora_fin) continue;  // Valido campos
      const nuevo = await crearModel({ usuario_id, dia_semana, hora_inicio, hora_fin });  // Inserto en BD
      created.push(nuevo);
    }

    if (!created.length) {
      return res.status(400).json({ error: 'No se creó ninguna disponibilidad válida.' });  // Sin datos válidos
    }

    res.status(201).json(created);  // Devuelvo creaciones
  } catch (error) {
    console.error('❌ Error al crear disponibilidad:', error);
    res.status(500).json({ error: 'Error del servidor' });  // Error de servidor
  }
};

// GET /disponibilidades
const listarDisponibilidades = async (req, res) => {
  try {
    const all = await obtenerDisponibilidades();  // Obtengo todas las disponibilidades
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
    await eliminarModel(id);  // Elimino por ID
    res.json({ mensaje: 'Disponibilidad eliminada correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar disponibilidad:', error);
    res.status(500).json({ error: 'Error del servidor al eliminar disponibilidad' });
  }
};

// DELETE /disponibilidades
const eliminarTodas = async (req, res) => {
  try {
    await eliminarTodasDisponibilidades();  // Elimino todo
    res.json({ mensaje: 'Todas las disponibilidades eliminadas correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar todas las disponibilidades:', error);
    res.status(500).json({ error: 'Error del servidor al eliminar todas las disponibilidades' });
  }
};

module.exports = {
  crearDisponibilidad,    // Exporto POST
  listarDisponibilidades, // Exporto GET
  eliminarDisponibilidad, // Exporto DELETE/:id
  eliminarTodas           // Exporto DELETE all
};