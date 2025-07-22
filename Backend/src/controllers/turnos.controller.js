const {
  crearTurno,
  obtenerTurnos,
  obtenerTurnosPorUsuario,
  obtenerTurnosPorFecha,
  updateTurno: updateTurnoModel,
  eliminarTurno: eliminarTurnoModel,
  eliminarTodosTurnos
} = require('../models/turno.model'); // Importo funciones del modelo de turnos

const { generarTurnosAutomaticamente } = require('../services/generadorHorarios'); // Importo servicio de generación automática
const { sugerirIntercambio } = require('../services/recomendacionesHorarios');   // Importo servicio de recomendaciones
const { sendMail } = require('../services/emailService');                         // Importo servicio de correo

const registrarTurno = async (req, res) => {
  try {
    // Registro uno o varios turnos según el cuerpo de la petición
    const turnos = Array.isArray(req.body) ? req.body : [req.body];
    const resultados = [];

    for (const t of turnos) {
      // Desestructuro los datos del turno
      const { usuario_id, fecha, hora_inicio, hora_fin, creado_por } = t;
      // Continúo sólo si tengo todos los campos requeridos
      if (!usuario_id || !fecha || !hora_inicio || !hora_fin || !creado_por) continue;
      // Creo el turno en la base de datos
      const nuevo = await crearTurno(t);
      resultados.push(nuevo);
    }

    // Si no creé ningún turno válido, devuelvo un error
    if (resultados.length === 0) {
      return res.status(400).json({ error: 'No se pudo registrar ningún turno válido.' });
    }

    // Devuelvo los turnos creados con código 201
    res.status(201).json(resultados);
  } catch (error) {
    console.error('❌ Error al registrar turnos:', error);
    // Manejo de error de servidor
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const listarTurnos = async (req, res) => {
  try {
    // Obtengo todos los turnos
    const t = await obtenerTurnos();
    res.json(t);
  } catch (error) {
    console.error('❌ Error al obtener turnos:', error);
    // Manejo de error de servidor
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const turnosPorUsuario = async (req, res) => {
  try {
    // Obtengo el ID del usuario desde params
    const { id } = req.params;
    // Obtengo turnos asociados a ese usuario
    const t = await obtenerTurnosPorUsuario(id);
    res.json(t);
  } catch (error) {
    console.error('❌ Error al obtener turnos por usuario:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const turnosPorFecha = async (req, res) => {
  try {
    // Obtengo la fecha desde params
    const { fecha } = req.params;
    // Obtengo turnos para esa fecha
    const t = await obtenerTurnosPorFecha(fecha);
    res.json(t);
  } catch (error) {
    console.error('❌ Error al obtener turnos por fecha:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const generarHorario = async (req, res) => {
  try {
    // Recibo la fecha de inicio para generación automática
    const { fechaInicio } = req.body;
    // Genero los turnos automáticamente usando el servicio
    const resultado = await generarTurnosAutomaticamente(fechaInicio);
    res.json({ mensaje: 'Horario generado con éxito', detalle: resultado });
  } catch (error) {
    console.error('❌ Error al generar horario:', error);
    res.status(500).json({ error: 'No se pudo generar el horario automáticamente' });
  }
};

const recomendarIntercambio = async (req, res) => {
  // Desestructuro los datos del turno origen
  const { usuario_id, fecha, hora_inicio, hora_fin } = req.body;
  // Valido parámetros
  if (!usuario_id || !fecha || !hora_inicio || !hora_fin) {
    return res.status(400).json({ error: 'Parámetros incompletos para intercambio' });
  }
  try {
    // Preparo el objeto turno origen
    const turnoOrigen = { usuario_id, fecha, hora_inicio, hora_fin };
    // Obtengo recomendaciones de intercambio
    const recomendaciones = await sugerirIntercambio(turnoOrigen);
    res.json({ recomendados: recomendaciones });
  } catch (error) {
    console.error('❌ Error al sugerir intercambio:', error);
    res.status(500).json({ error: 'Error del servidor al sugerir intercambio' });
  }
};

const actualizarTurno = async (req, res) => {
  try {
    // Obtengo el ID del turno a actualizar
    const { id } = req.params;
    // Actualizo el turno con los datos del body
    const actualizado = await updateTurnoModel(id, req.body);
    res.json(actualizado);
  } catch (error) {
    console.error('❌ Error al actualizar turno:', error);
    res.status(500).json({ error: 'Error del servidor al actualizar turno' });
  }
};

const eliminarTurno = async (req, res) => {
  try {
    // Obtengo el ID del turno a eliminar
    const { id } = req.params;
    // Elimino el turno de la base de datos
    await eliminarTurnoModel(id);
    res.json({ mensaje: 'Turno eliminado correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar turno:', error);
    res.status(500).json({ error: 'Error del servidor al eliminar turno' });
  }
};

const eliminarTodos = async (req, res) => {
  try {
    // Elimino todos los turnos
    await eliminarTodosTurnos();
    res.json({ mensaje: 'Todos los turnos eliminados correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar todos los turnos:', error);
    res.status(500).json({ error: 'Error del servidor al eliminar todos los turnos' });
  }
};

const enviarCalendario = async (req, res) => {
  try {
    // Desestructuro destinatarios, asunto y contenido HTML
    const { destinatarios, asunto, html } = req.body;
    // Valido que los datos sean correctos
    if (!Array.isArray(destinatarios) || !asunto || !html) {
      return res.status(400).json({ error: 'Faltan destinatarios, asunto o html' });
    }
    // Envío el correo con el calendario
    await sendMail({ to: destinatarios, subject: asunto, html });
    res.json({ mensaje: 'Correo enviado correctamente' });
  } catch (error) {
    console.error('❌ Error al enviar correo:', error);
    res.status(500).json({ error: 'No se pudo enviar el correo' });
  }
};

module.exports = {
  registrarTurno,
  listarTurnos,
  turnosPorUsuario,
  turnosPorFecha,
  generarHorario,
  recomendarIntercambio,
  actualizarTurno,
  eliminarTurno,
  eliminarTodos,
  enviarCalendario
};