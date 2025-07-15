const db = require('../config/db');

// Nombres de días para mapear fechas
const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

// Reglas por tipo de contrato
const REGLAS = {
  45: { diasSemana: 5, domingosPorMes: 2 },
  30: { diasSemana: 5, domingosPorMes: 2 },
  20: { diasSemana: 4, domingosPorMes: 0 },
  16: { diasSemana: 2, soloDias: ['sábado','domingo'], domingosPorMes: 0 }
};

// Convierte "HH:MM" o "HH:MM:SS" a minutos
function parseTime(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// Calcula horas trabajadas, restando 1h de colación
function calcularHoras(turno) {
  const start = parseTime(turno.hora_inicio);
  const end   = parseTime(turno.hora_fin);
  const dur   = (end - start) / 60;
  return Math.max(0, dur - 1);
}

// Comprueba solapamiento contra un array de turnos
function tieneSolapamiento(turno, otros) {
  return otros.some(t => {
    if (t.fecha !== turno.fecha) return false;
    const a1 = parseTime(t.hora_inicio), a2 = parseTime(t.hora_fin);
    const b1 = parseTime(turno.hora_inicio), b2 = parseTime(turno.hora_fin);
    return a1 < b2 && b1 < a2;
  });
}

// Comprueba si un turno cabe dentro de la disponibilidad registrada
function dentroDisponibilidad(turno, disp) {
  return parseTime(disp.hora_inicio) <= parseTime(turno.hora_inicio)
      && parseTime(disp.hora_fin)   >= parseTime(turno.hora_fin);
}

/**
 * Comprueba todas las reglas para ver si `usuario` podría tomar `turno`
 */
function puedeAsignarShift(usuario, turno, dispMap, beneMap, shifts) {
  // protección: si usuario indefinido, devolvemos false
  if (!usuario) return false;

  const diaNombre = DIAS[new Date(turno.fecha).getDay()];
  const disp = dispMap[usuario.id]?.[diaNombre];
  if (!disp) return false;

  if (!dentroDisponibilidad(turno, disp)) return false;
  if (beneMap[usuario.id]?.has(turno.fecha)) return false;

  const regla = REGLAS[usuario.horas_contrato];
  if (!regla) return false;

  if (regla.soloDias && !regla.soloDias.includes(diaNombre)) return false;

  if (diaNombre === 'domingo') {
    const domingosAsignados = shifts.filter(t => new Date(t.fecha).getDay() === 0).length;
    if (domingosAsignados >= regla.domingosPorMes) return false;
  }

  const usadas = shifts.reduce((sum, t) => sum + calcularHoras(t), 0);
  if (usadas + calcularHoras(turno) > usuario.horas_contrato) return false;

  if (parseTime(turno.hora_inicio) >= parseTime('16:30') && !usuario.puede_cerrar) {
    return false;
  }

  if (tieneSolapamiento(turno, shifts)) return false;

  return true;
}

/**
 * Dado un turno “origen”, sugiere posibles intercambios contra cualquier otro turno
 * de la misma semana.
 */
async function sugerirIntercambio(turnoOrigen) {
  // 1) rango lunes–domingo
  const d0 = new Date(turnoOrigen.fecha);
  const dia  = d0.getDay();              // 0=dom
  const lunes = new Date(d0);
  lunes.setDate(d0.getDate() - ((dia + 6) % 7));
  const domingo = new Date(lunes);
  domingo.setDate(lunes.getDate() + 6);
  const startWeek = lunes.toISOString().slice(0,10);
  const endWeek   = domingo.toISOString().slice(0,10);

  // 2) cargo datos
  const { rows: usuarios } = await db.query(
    'SELECT id, horas_contrato, puede_cerrar FROM usuarios'
  );
  const { rows: disponibilidades } = await db.query('SELECT * FROM disponibilidades');
  const { rows: beneficios } = await db.query('SELECT * FROM beneficios');
  const { rows: turnsWeek } = await db.query(
    'SELECT usuario_id, fecha, hora_inicio, hora_fin FROM turnos WHERE fecha BETWEEN $1 AND $2',
    [startWeek, endWeek]
  );

  // 3) índices de ayuda
  const dispMap = {};
  disponibilidades.forEach(d => {
    dispMap[d.usuario_id] ||= {};
    dispMap[d.usuario_id][d.dia_semana] = d;
  });
  const beneMap = {};
  beneficios.forEach(b => {
    beneMap[b.usuario_id] ||= new Set();
    beneMap[b.usuario_id].add(b.fecha.toISOString().slice(0,10));
  });
  const turnsByUser = {};
  turnsWeek.forEach(t => {
    turnsByUser[t.usuario_id] ||= [];
    turnsByUser[t.usuario_id].push(t);
  });

  const sugeridos = [];
  const idX = turnoOrigen.usuario_id;
  const userX = usuarios.find(u => u.id === idX);
  if (!userX) {
    console.warn(`Usuario origen ${idX} no encontrado en usuarios.`);
    return [];
  }
  // quito de shiftsX el turnoOrigen mismo
  const shiftsX = (turnsByUser[idX] || [])
    .filter(t => !(t.fecha === turnoOrigen.fecha && t.hora_inicio === turnoOrigen.hora_inicio));

  // 4) para cada turno T de la semana
  for (const t of turnsWeek) {
    if (t.usuario_id === idX) continue;

    const userY = usuarios.find(u => u.id === t.usuario_id);
    if (!userY) {
      console.warn(`Usuario destino ${t.usuario_id} no encontrado en usuarios.`);
      continue;
    }

    // turnos de Y sin el turno t
    const shiftsY = (turnsByUser[userY.id] || [])
      .filter(uT => !(uT.fecha === t.fecha && uT.hora_inicio === t.hora_inicio));

    // a) ¿puede Y cubrir el turnoOrigen?
    if (!puedeAsignarShift(userY, turnoOrigen, dispMap, beneMap, shiftsY)) {
      continue;
    }

    // b) ¿puede X cubrir el turno de Y?
    const turnoDestino = { fecha: t.fecha, hora_inicio: t.hora_inicio, hora_fin: t.hora_fin };
    if (!puedeAsignarShift(userX, turnoDestino, dispMap, beneMap, shiftsX)) {
      continue;
    }

    // c) ambos pasan => sugerido
    sugeridos.push({
      usuario_id:   userY.id,
      turnoDestino
    });
  }

  return sugeridos;
}

module.exports = { sugerirIntercambio };