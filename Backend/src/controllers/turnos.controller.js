const {
  crearTurno,
  obtenerTurnos,
  obtenerTurnosPorUsuario,
  obtenerTurnosPorFecha,
  updateTurno: updateTurnoModel,
  eliminarTurno: eliminarTurnoModel,
  eliminarTodosTurnos
} = require('../models/turno.model');
const { generarTurnosAutomaticamente } = require('../services/generadorHorarios');
const { sugerirIntercambio } = require('../services/recomendacionesHorarios');
const { sendMail } = require('../services/emailService');
const pool = require('../config/db');

// Helper para convertir "HH:MM" o "HH:MM:SS" a minutos
function toMinutes(hm) {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

// POST /turnos
const registrarTurno = async (req, res) => {
  try {
    const turnos = Array.isArray(req.body) ? req.body : [req.body];
    const resultados = [];

    for (const t of turnos) {
      const { usuario_id, fecha, hora_inicio, hora_fin, creado_por } = t;
      if (!usuario_id || !fecha || !hora_inicio || !hora_fin || !creado_por) continue;

      // 1) Día de la semana en minúsculas
      const [y, m, d] = fecha.split('-').map(Number);
      const diaNombre = new Date(y, m - 1, d)
        .toLocaleDateString('es-CL', { weekday: 'long' })
        .toLowerCase();

      // 2) Obtenemos la disponibilidad del usuario para ese día
      const dispRes = await pool.query(
        `SELECT hora_inicio, hora_fin
         FROM disponibilidades
         WHERE usuario_id = $1 AND dia_semana = $2`,
        [usuario_id, diaNombre]
      );

      // 3) Preguntamos si puede cerrar (para excepciones de turno de cierre)
      const userRes = await pool.query(
        `SELECT puede_cerrar
         FROM usuarios
         WHERE id = $1`,
        [usuario_id]
      );
      const puedeCerrar = !!userRes.rows[0]?.puede_cerrar;

      // 4) Validación de disponibilidad en minutos
      if (dispRes.rows.length === 0) {
        return res.status(400).json({
          error: `No disponible el ${diaNombre} (sin disponibilidad definida).`
        });
      }
      const availInicio = toMinutes(dispRes.rows[0].hora_inicio);
      const availFin    = toMinutes(dispRes.rows[0].hora_fin);
      const inInicio    = toMinutes(hora_inicio);
      const inFin       = toMinutes(hora_fin);

      const fueraDeRango = inInicio < availInicio || inFin > availFin;
      if (fueraDeRango) {
        // Permitimos solo turno de cierre si termina a 23:30 y puede_cerrar=true
        if (!(puedeCerrar && hora_fin === '23:30')) {
          return res.status(400).json({
            error: `No disponible el ${diaNombre} de ${dispRes.rows[0].hora_inicio} a ${dispRes.rows[0].hora_fin}.`
          });
        }
      }

      // 5) Creo el turno
      const nuevo = await crearTurno(t);
      resultados.push(nuevo);
    }

    if (resultados.length === 0) {
      return res
        .status(400)
        .json({ error: 'No se pudo registrar ningún turno válido.' });
    }

    res.status(201).json(resultados);
  } catch (error) {
    console.error('❌ Error al registrar turnos:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// GET /turnos
const listarTurnos = async (_req, res) => {
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
const eliminarTodos = async (_req, res) => {
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

    const match = html.match(/src="(data:image\/[^;]+;base64,[^"]+)"/);
    let finalHtml = html;
    const attachments = [];

    if (match) {
      const dataUri = match[1];
      const [meta, b64] = dataUri.split(',');
      const ext = (meta.match(/image\/(.+);base64/) || [])[1] || 'png';
      finalHtml = html.replace(dataUri, 'cid:planilla@turnos');
      attachments.push({
        filename: `planilla.${ext}`,
        content: Buffer.from(b64, 'base64'),
        cid: 'planilla@turnos'
      });
    }

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

// GET /turnos/resumen
const resumenTurnos = async (req, res) => {
  try {
    const { fechaInicio, fechaFin } = req.query;
    const { rows } = await pool.query(
      `SELECT 
         t.usuario_id,
         u.nombre,
         COUNT(*)               AS total_turnos,
         SUM((hora_fin = '23:30')::int)             AS cierres,
         SUM((hora_inicio BETWEEN '08:00' AND '10:00')::int) AS aperturas
       FROM turnos t
       JOIN usuarios u ON u.id = t.usuario_id
       WHERE fecha BETWEEN $1 AND $2
       GROUP BY t.usuario_id, u.nombre
       ORDER BY cierres DESC, aperturas DESC;`,
      [fechaInicio, fechaFin]
    );
    res.json(rows);
  } catch (error) {
    console.error('❌ Error al obtener resumen de turnos:', error);
    res.status(500).json({ error: 'Error del servidor' });
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
  enviarCalendario,
  resumenTurnos
};
