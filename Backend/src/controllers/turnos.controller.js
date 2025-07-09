const db = require('../config/db');
const {
  crearTurno,
  obtenerTurnos,
  obtenerTurnosPorUsuario,
  obtenerTurnosPorFecha
} = require('../models/turno.model');
const { generarTurnosAutomaticamente } = require('../services/generadorHorarios');
const { sugerirIntercambio } = require('../services/recomendacionesHorarios');

/** Convierte "HH:MM" o "HH:MM:SS" a minutos desde 00:00 */
function parseTime(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Calcula duración neta en horas, restando 1h de colación */
function calcularHorasNetas(hora_inicio, hora_fin) {
  const minutos = parseTime(hora_fin) - parseTime(hora_inicio);
  return Math.max(0, minutos / 60 - 1);
}

const registrarTurno = async (req, res) => {
  try {
    // Aceptamos array o un solo objeto
    const bodyTurnos = Array.isArray(req.body) ? req.body : [req.body];

    // Ordenamos por fecha para que la acumulación sea cronológica
    bodyTurnos.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));

    // Llevamos en memoria las horas acumuladas por usuario en este lote
    const horasAcum = {};

    const resultados = [];

    for (const turno of bodyTurnos) {
      const {
        usuario_id,
        fecha,
        hora_inicio,
        hora_fin,
        creado_por,
        observaciones = ''
      } = turno;

      if (!usuario_id || !fecha || !hora_inicio || !hora_fin || !creado_por) {
        console.warn('⚠️ Turno incompleto omitido:', turno);
        continue;
      }

      // 1) Inserto el turno
      const nuevo = await crearTurno({
        usuario_id,
        fecha,
        hora_inicio,
        hora_fin,
        creado_por,
        observaciones
      });

      // 2) Leo el contrato del usuario
      const { rows: [usr] } = await db.query(
        'SELECT horas_contrato FROM usuarios WHERE id = $1',
        [usuario_id]
      );
      const horasContrato = usr?.horas_contrato ?? 0;

      // 3) Calculamos la duración neta de este turno
      const netas = calcularHorasNetas(hora_inicio, hora_fin);

      // 4) Acumulamos en memoria
      horasAcum[usuario_id] = (horasAcum[usuario_id] || 0) + netas;

      // 5) Guardamos el resultado
      resultados.push({
        turno: nuevo,
        horasTrabajadas: horasAcum[usuario_id],
        horasContrato
      });
    }

    if (resultados.length === 0) {
      return res.status(400).json({ error: 'No se pudo registrar ningún turno válido.' });
    }

    return res.status(201).json(resultados);

  } catch (error) {
    console.error('❌ Error al registrar turnos:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};

const listarTurnos = async (req, res) => {
  try {
    const turnos = await obtenerTurnos();
    return res.json(turnos);
  } catch (error) {
    console.error('❌ Error al obtener turnos:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};

const turnosPorUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const turnos = await obtenerTurnosPorUsuario(id);
    return res.json(turnos);
  } catch (error) {
    console.error('❌ Error al obtener turnos por usuario:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};

const turnosPorFecha = async (req, res) => {
  try {
    const { fecha } = req.params;
    const turnos = await obtenerTurnosPorFecha(fecha);
    return res.json(turnos);
  } catch (error) {
    console.error('❌ Error al obtener turnos por fecha:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
};

const generarHorario = async (req, res) => {
  const { fechaInicio } = req.body;
  try {
    const resultado = await generarTurnosAutomaticamente(fechaInicio);
    return res.status(200).json({ mensaje: 'Horario generado con éxito', detalle: resultado });
  } catch (error) {
    console.error('❌ Error al generar horario automáticamente:', error);
    return res.status(500).json({ error: 'No se pudo generar el horario automáticamente' });
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
    return res.json({ recomendados: recomendaciones });
  } catch (error) {
    console.error('❌ Error al sugerir intercambio:', error);
    return res.status(500).json({ error: 'Error del servidor al sugerir intercambio' });
  }
};

module.exports = {
  registrarTurno,
  listarTurnos,
  turnosPorUsuario,
  turnosPorFecha,
  generarHorario,
  recomendarIntercambio
};