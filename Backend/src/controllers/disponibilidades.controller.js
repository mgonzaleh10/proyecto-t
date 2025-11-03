// src/controllers/disponibilidades.controller.js

const {
  crearDisponibilidad: crearModel,       // Alias para función de creación
  obtenerDisponibilidades,               // Listar todas
  eliminarDisponibilidad: eliminarModel, // Eliminar por ID
  eliminarTodasDisponibilidades          // Eliminar todo
} = require('../models/disponibilidad.model');

// ⬇️ Servicio que actualiza la hoja "Trabajador" (H:I y K:N) en Datos_v8.xlsx
const { syncDisponibilidadesSheet } = require('../services/excelDisponibilidades');

// POST /disponibilidades
// Acepta objeto único o arreglo de objetos
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

    // 🔄 Dispara la sincronización de Excel (en background, sin bloquear la respuesta)
    syncDisponibilidadesSheet()
      .catch(err => console.error('Excel sync (disponibilidades - crear) falló:', err));

    res.status(201).json(created);  // Devuelvo creaciones
  } catch (error) {
    console.error('❌ Error al crear disponibilidad:', error);
    res.status(500).json({ error: 'Error del servidor' });  // Error de servidor
  }
};

// GET /disponibilidades
const listarDisponibilidades = async (_req, res) => {
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

    // 🔄 Sincronización tras eliminar una fila
    syncDisponibilidadesSheet()
      .catch(err => console.error('Excel sync (disponibilidades - delete) falló:', err));

    res.json({ mensaje: 'Disponibilidad eliminada correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar disponibilidad:', error);
    res.status(500).json({ error: 'Error del servidor al eliminar disponibilidad' });
  }
};

// DELETE /disponibilidades
const eliminarTodas = async (_req, res) => {
  try {
    await eliminarTodasDisponibilidades();  // Elimino todo

    // 🔄 Sincronización tras limpieza total
    syncDisponibilidadesSheet()
      .catch(err => console.error('Excel sync (disponibilidades - delete all) falló:', err));

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
