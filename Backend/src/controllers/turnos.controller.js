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
const pool = require('../config/db');                                             // Importo pool para validar disponibilidades

// POST /turnos
const registrarTurno = async (req, res) => {
  try {
    // Acepto uno o varios turnos en el body
    const turnos = Array.isArray(req.body) ? req.body : [req.body];
    const resultados = [];

    for (const t of turnos) {
      // Desestructuro datos del turno
      const { usuario_id, fecha, hora_inicio, hora_fin, creado_por } = t;
      // Ignoro si faltan campos
      if (!usuario_id || !fecha || !hora_inicio || !hora_fin || !creado_por) continue;

      // ---- NUEVO: Parseo fecha en local para evitar desfase UTC ----
      const [y, m, d] = fecha.split('-').map(Number);
      const localDate = new Date(y, m - 1, d);
      const diaNombre = localDate
        .toLocaleDateString('es-CL', { weekday: 'long' })
        .toLowerCase();
      // --------------------------------------------------------------

      // Consulto la disponibilidad registrada
      const dispRes = await pool.query(
        `SELECT hora_inicio, hora_fin
         FROM disponibilidades
         WHERE usuario_id = $1 AND dia_semana = $2`,
        [usuario_id, diaNombre]
      );

      // Si no existe o está fuera de rango, rechazo con mensaje claro
      if (
        dispRes.rows.length === 0 ||
        hora_inicio < dispRes.rows[0].hora_inicio ||
        hora_fin > dispRes.rows[0].hora_fin
      ) {
        return res.status(400).json({
          error: `No disponible el ${diaNombre} de ${dispRes.rows[0]?.hora_inicio || '--'} a ${dispRes.rows[0]?.hora_fin || '--'}.`
        });
      }

      // Si pasa la validación, creo el turno
      const nuevo = await crearTurno(t);
      resultados.push(nuevo);
    }

    // Si no se creó ninguno, retorno error
    if (resultados.length === 0) {
      return res.status(400).json({ error: 'No se pudo registrar ningún turno válido.' });
    }

    // Devuelvo los turnos creados
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

const actualizarTurno = async (req, res) => {
  try {
    const { id } = req.params;
    const actualizado = await updateTurnoModel(id, req.body);
    res.json(actualizado);
  } catch (error) {
    console.error('❌ Error al actualizar turno:', error);
    res.status(500).json({ error: 'Error del servidor al actualizar turno' });
  }
};

const eliminarTurno = async (req, res) => {
  try {
    const { id } = req.params;
    await eliminarTurnoModel(id);
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

const enviarCalendario = async (req, res) => {
  try {
    const { destinatarios, asunto, html } = req.body;
    if (!Array.isArray(destinatarios) || !asunto || !html) {
      return res.status(400).json({ error: 'Faltan destinatarios, asunto o html' });
    }
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