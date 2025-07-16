const {
  crearTurno,
  obtenerTurnos,
  obtenerTurnosPorUsuario,
  obtenerTurnosPorFecha,
  eliminarTurnoPorId,
  eliminarTodosTurnos,
  actualizarTurnoPorId
} = require('../models/turno.model');
const { generarTurnosAutomaticamente } = require('../services/generadorHorarios');
const { sugerirIntercambio } = require('../services/recomendacionesHorarios');

const registrarTurno = async (req, res) => {
  try {
    const turnos = Array.isArray(req.body) ? req.body : [req.body];
    const resultados = [];
    for (const t of turnos) {
      const { usuario_id, fecha, hora_inicio, hora_fin, creado_por } = t;
      if (!usuario_id || !fecha || !hora_inicio || !hora_fin || !creado_por) continue;
      const nuevo = await crearTurno(t);
      resultados.push(nuevo);
    }
    if (resultados.length === 0) {
      return res.status(400).json({ error: 'No se pudo registrar ningún turno válido.' });
    }
    res.status(201).json(resultados);
  } catch (error) {
    console.error('❌ Error al registrar turnos:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const listarTurnos = async (req, res) => {
  try {
    const t = await obtenerTurnos();
    res.json(t);
  } catch (error) {
    console.error('❌ Error al obtener turnos:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const turnosPorUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const t = await obtenerTurnosPorUsuario(id);
    res.json(t);
  } catch (error) {
    console.error('❌ Error al obtener turnos por usuario:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const turnosPorFecha = async (req, res) => {
  try {
    const { fecha } = req.params;
    const t = await obtenerTurnosPorFecha(fecha);
    res.json(t);
  } catch (error) {
    console.error('❌ Error al obtener turnos por fecha:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const generarHorario = async (req, res) => {
  try {
    const { fechaInicio } = req.body;
    const resultado = await generarTurnosAutomaticamente(fechaInicio);
    res.json({ mensaje: 'Horario generado con éxito', detalle: resultado });
  } catch (error) {
    console.error('❌ Error al generar horario:', error);
    res.status(500).json({ error: 'No se pudo generar el horario automáticamente' });
  }
};

const recomendarIntercambio = async (req, res) => {
  const { usuario_id, fecha, hora_inicio, hora_fin } = req.body;
  if (!usuario_id || !fecha || !hora_inicio || !hora_fin) {
    return res.status(400).json({ error: 'Parámetros incompletos para intercambio' });
  }
  try {
    const turnoOrigen = { usuario_id, fecha, hora_inicio, hora_fin };
    const recomendaciones = await sugerirIntercambio(turnoOrigen);
    res.json({ recomendados: recomendaciones });
  } catch (error) {
    console.error('❌ Error al sugerir intercambio:', error);
    res.status(500).json({ error: 'Error del servidor al sugerir intercambio' });
  }
};

const eliminarTurno = async (req, res) => {
  try {
    const { id } = req.params;
    await eliminarTurnoPorId(id);
    res.json({ mensaje: 'Turno eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar turno:', error);
    res.status(500).json({ error: 'Error del servidor al eliminar turno' });
  }
};

const eliminarTodos = async (req, res) => {
  try {
    await eliminarTodosTurnos();
    res.json({ mensaje: 'Todos los turnos eliminados correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar todos los turnos:', error);
    res.status(500).json({ error: 'Error del servidor al eliminar todos los turnos' });
  }
};

const actualizarTurno = async (req, res) => {
  try {
    const { id } = req.params;
    const cambios = req.body; // { fecha, hora_inicio, hora_fin, observaciones }
    const actualizado = await actualizarTurnoPorId(id, cambios);
    if (!actualizado) {
      return res.status(404).json({ error: 'Turno no encontrado' });
    }
    res.json(actualizado);
  } catch (error) {
    console.error('❌ Error al actualizar turno:', error);
    res.status(500).json({ error: 'Error del servidor al actualizar turno' });
  }
};

module.exports = {
  registrarTurno,
  listarTurnos,
  turnosPorUsuario,
  turnosPorFecha,
  generarHorario,
  recomendarIntercambio,
  eliminarTurno,
  eliminarTodos,
  actualizarTurno
};