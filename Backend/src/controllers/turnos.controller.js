const {
  crearTurno,
  obtenerTurnos,
  obtenerTurnosPorUsuario,
  obtenerTurnosPorFecha,
  updateTurno: updateTurnoModel,
  eliminarTurno: eliminarTurnoModel,
  eliminarTodosTurnos
} = require('../models/turno.model');                      // Importo funciones del modelo de turnos
const { generarTurnosAutomaticamente } = require('../services/generadorHorarios'); // Servicio de generación automática
const { sugerirIntercambio }       = require('../services/recomendacionesHorarios'); // Servicio de recomendaciones
const { sendMail }                 = require('../services/emailService');            // Servicio de correo
const pool                         = require('../config/db');                        // Pool para queries directas

// POST /turnos
const registrarTurno = async (req, res) => {
  try {
    const turnos = Array.isArray(req.body) ? req.body : [req.body];
    const resultados = [];

    for (const t of turnos) {
      const { usuario_id, fecha, hora_inicio, hora_fin, creado_por } = t;
      if (!usuario_id || !fecha || !hora_inicio || !hora_fin || !creado_por) continue;

      // Parseo fecha local y obtengo día de la semana en minúsculas
      const [y, m, d] = fecha.split('-').map(Number);
      const diaNombre = new Date(y, m - 1, d)
        .toLocaleDateString('es-CL', { weekday: 'long' })
        .toLowerCase();

      // Valido disponibilidad
      const dispRes = await pool.query(
        `SELECT hora_inicio, hora_fin
         FROM disponibilidades
         WHERE usuario_id = $1 AND dia_semana = $2`,
        [usuario_id, diaNombre]
      );

      if (
        dispRes.rows.length === 0 ||
        hora_inicio < dispRes.rows[0].hora_inicio ||
        hora_fin > dispRes.rows[0].hora_fin
      ) {
        return res.status(400).json({
          error: `No disponible el ${diaNombre} de ${dispRes.rows[0]?.hora_inicio || '--'} a ${dispRes.rows[0]?.hora_fin || '--'}.`
        });
      }

      // Creo el turno
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

// GET /turnos
const listarTurnos = async (req, res) => {
  try {
    const t = await obtenerTurnos();
    res.json(t);
  } catch (error) {
    console.error('❌ Error al obtener turnos:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// GET /turnos/:id
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

// GET /turnos/fecha/:fecha
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

// POST /turnos/generar
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

// POST /turnos/intercambio
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

// PUT /turnos/:id
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

// DELETE /turnos/:id
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

// DELETE /turnos
const eliminarTodos = async (req, res) => {
  try {
    await eliminarTodosTurnos();
    res.json({ mensaje: 'Todos los turnos eliminados correctamente' });
  } catch (error) {
    console.error('❌ Error al eliminar todos los turnos:', error);
    res.status(500).json({ error: 'Error del servidor al eliminar todos los turnos' });
  }
};

// POST /turnos/enviar-correo
const enviarCalendario = async (req, res) => {
  try {
    const { destinatarios, asunto, html } = req.body;
    if (!Array.isArray(destinatarios) || !asunto || !html) {
      return res.status(400).json({ error: 'Faltan destinatarios, asunto o html' });
    }

    // Busco data‑URI de la imagen en el HTML
    const match = html.match(/src="(data:image\/[^;]+;base64,[^"]+)"/);
    let finalHtml = html;
    const attachments = [];

    if (match) {
      const dataUri = match[1];
      const [meta, b64] = dataUri.split(',');
      const ext = (meta.match(/image\/(.+);base64/) || [])[1] || 'png';

      // Reemplazo data‑URI por CID
      finalHtml = html.replace(dataUri, 'cid:planilla@turnos');

      attachments.push({
        filename: `planilla.${ext}`,
        content: Buffer.from(b64, 'base64'),
        cid: 'planilla@turnos'
      });
    }

    // Envío el correo con attachments si existen
    await sendMail({
      to: destinatarios,
      subject: asunto,
      html: finalHtml,
      attachments
    });

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