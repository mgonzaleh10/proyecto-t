// src/services/recomendacionesHorarios.js (CommonJS)
const pool = require('../config/db.js');

/* ========================== Helpers de tiempo/fechas ========================== */

// Acepta 'YYYY-MM-DD', Date, o 'YYYY-MM-DDTHH:mm:ssZ'
function toDate(x) {
  if (x instanceof Date) return x;
  if (typeof x === 'string') {
    if (!x.includes('T')) return new Date(`${x}T00:00:00`);
    return new Date(x);
  }
  throw new Error(`Fecha inválida: ${x}`);
}
const fmt = (d) => d.toISOString().slice(0, 10);

function getWeekRange(dateStr) {
  const d = toDate(dateStr);
  const dow = (d.getDay() + 6) % 7; // 0=lun
  const start = new Date(d); start.setDate(d.getDate() - dow);
  const end = new Date(start); end.setDate(start.getDate() + 6);
  return { start: fmt(start), end: fmt(end) };
}

function minutesBetween(t1, t2) {
  const p = (t) => t.split(':').map(Number);
  const [h1, m1] = p(t1);
  const [h2, m2] = p(t2);
  return (h2 * 60 + m2) - (h1 * 60 + m1);
}
const hoursBetween = (t1, t2) => minutesBetween(t1, t2) / 60;

function sameDay(a, b) {
  return fmt(toDate(a)) === fmt(toDate(b));
}

function dayName(dateStr) {
  const d = toDate(dateStr);
  const idx = (d.getDay() + 6) % 7;
  return ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'][idx];
}

function timeInRange(t, from, to) {
  return minutesBetween(from, t) >= 0 && minutesBetween(t, to) >= 0;
}
function rangeWithin(aStart, aEnd, bStart, bEnd) {
  return timeInRange(aStart, bStart, bEnd) && timeInRange(aEnd, bStart, bEnd);
}

/* ========================== Acceso a datos ========================== */

async function getUsuariosMap() {
  const { rows } = await pool.query('SELECT id, nombre, horas_contrato FROM usuarios');
  const map = new Map();
  rows.forEach(r => map.set(r.id, r));
  return map;
}

async function getTurnosSemana({ start, end }) {
  const { rows } = await pool.query(
    `SELECT id, usuario_id, fecha, hora_inicio, hora_fin
     FROM turnos
     WHERE fecha BETWEEN $1 AND $2
     ORDER BY usuario_id, fecha, hora_inicio`,
    [start, end]
  );
  return rows;
}

async function getDisponibilidades() {
  const { rows } = await pool.query(
    `SELECT id, usuario_id, dia_semana, hora_inicio, hora_fin FROM disponibilidades`
  );
  const map = new Map(); // clave: "usuarioId|día"
  rows.forEach(r => {
    const k = `${r.usuario_id}|${String(r.dia_semana).toLowerCase()}`;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push({ inicio: r.hora_inicio, fin: r.hora_fin });
  });
  return map;
}

/* ========================== Lógica de negocio ========================== */

function isAvailable(dispoMap, usuarioId, fecha, inicio, fin) {
  const k = `${usuarioId}|${dayName(fecha)}`;
  const franjas = dispoMap.get(k) || [];
  return franjas.some(fr => rangeWithin(inicio, fin, fr.inicio, fr.fin));
}

function summarizeHours(turnos) {
  const acc = new Map();
  turnos.forEach(t => {
    const h = hoursBetween(t.hora_inicio, t.hora_fin);
    acc.set(t.usuario_id, (acc.get(t.usuario_id) || 0) + h);
  });
  return acc;
}

// NUEVO: horas y días por usuario (para descontar colación = 1h por día trabajado)
function summarizeWeekStats(turnos) {
  const hoursMap = new Map();
  const daysSetMap = new Map(); // Map<usuarioId, Set<YYYY-MM-DD>>
  turnos.forEach(t => {
    const h = hoursBetween(t.hora_inicio, t.hora_fin);
    hoursMap.set(t.usuario_id, (hoursMap.get(t.usuario_id) || 0) + h);
    if (!daysSetMap.has(t.usuario_id)) daysSetMap.set(t.usuario_id, new Set());
    daysSetMap.get(t.usuario_id).add(fmt(toDate(t.fecha)));
  });
  const daysCountMap = new Map();
  for (const [uid, set] of daysSetMap.entries()) {
    daysCountMap.set(uid, set.size);
  }
  return { hoursMap, daysCountMap };
}

function hasOverlap(turnosUsuario, fecha, inicio, fin, ignoreId = null) {
  return (turnosUsuario || []).some(x =>
    x.id !== ignoreId &&
    sameDay(x.fecha, fecha) &&
    !(x.hora_fin <= inicio || x.hora_inicio >= fin)
  );
}

// Cuando NO llega turno_id, intento identificar el turno real de A en DB
function findTurnoExactoA(turnosSemana, usuarioId, fecha, inicio, fin) {
  return (turnosSemana || []).find(t =>
    t.usuario_id === usuarioId &&
    sameDay(t.fecha, fecha) &&
    t.hora_inicio === inicio &&
    t.hora_fin === fin
  ) || null;
}

/* ========================== Servicio principal ========================== */

async function recomendarIntercambioService({
  usuarioId,           // A
  turnoOrigenId = null,
  fecha,               // 'YYYY-MM-DD'
  hora_inicio,
  hora_fin
}) {
  const debug = { pasos: [], descartes: {}, notas: [] };

  if (!fecha || !hora_inicio || !hora_fin) {
    throw new Error('Faltan fecha/hora_inicio/hora_fin');
  }

  const { start, end } = getWeekRange(fecha);
  debug.pasos.push({ semana: { start, end } });

  const [usuariosMap, turnosSemana, dispoMap] = await Promise.all([
    getUsuariosMap(),
    getTurnosSemana({ start, end }),
    getDisponibilidades(),
  ]);

  // Map turnos por usuario
  const turnosByUser = new Map();
  turnosSemana.forEach(t => {
    if (!turnosByUser.has(t.usuario_id)) turnosByUser.set(t.usuario_id, []);
    turnosByUser.get(t.usuario_id).push(t);
  });

  // Turno A (real si existe)
  let turnoA = null;
  if (turnoOrigenId) {
    turnoA = turnosSemana.find(t => t.id === Number(turnoOrigenId)) || null;
  }
  if (!turnoA) {
    const encontrado = findTurnoExactoA(turnosSemana, usuarioId, fecha, hora_inicio, hora_fin);
    if (encontrado) {
      turnoA = { ...encontrado };
    } else {
      turnoA = { id: null, usuario_id: usuarioId, fecha, hora_inicio, hora_fin };
    }
  }

  // Totales semanales (para swaps dejamos la métrica tal cual)
  const horasSemana = summarizeHours(turnosSemana);

  // NUEVO: horas efectivas = horas - días (colación 1h/día)
  const { hoursMap: horasMapRaw, daysCountMap } = summarizeWeekStats(turnosSemana);

  // Config
  const TOL_MIN = 30; // tolerancia de duración

  const coberturas = [];
  const swaps = [];
  const vistosSwap = new Set(); // uid|fechaB|inicioB|finB

  const idsCandidatos = [...usuariosMap.keys()].filter(id => id !== usuarioId);

  for (const uid of idsCandidatos) {
    const uInfo = usuariosMap.get(uid) || { nombre: `#${uid}`, horas_contrato: 999 };

    /* ---------- COBERTURAS (Horas extra con colación) ---------- */
    const bTurnosSemana = turnosByUser.get(uid) || [];
    const bLibreEseDia = !hasOverlap(bTurnosSemana, turnoA.fecha, turnoA.hora_inicio, turnoA.hora_fin, null);
    const bDisponible = isAvailable(dispoMap, uid, turnoA.fecha, turnoA.hora_inicio, turnoA.hora_fin);

    if (bLibreEseDia && bDisponible) {
      const hRaw = horasMapRaw.get(uid) || 0;             // horas “crudas” de sus turnos
      const dCnt = daysCountMap.get(uid) || 0;            // días con turno (colación 1h/día)
      const horasEfectivas = hRaw - dCnt;                 // aplica descuento por colación
      const delta = hoursBetween(turnoA.hora_inicio, turnoA.hora_fin);
      const afterEff = horasEfectivas + delta;            // **sin** descontar colación del nuevo día (según tu regla)
      const extras = Math.max(0, Math.round(afterEff - (uInfo.horas_contrato || 0)));

      // Score: menos extras => mejor
      const scoreBase = 40;
      const score = scoreBase - Math.min(20, extras);

      const motivo = ['Día libre, opción con horas extras'];

      coberturas.push({
        tipo: 'cobertura',
        usuario_id: uid,
        nombre: uInfo.nombre,
        score,
        motivo: motivo.join(' • '),
        fecha: turnoA.fecha,
        hora_inicio: turnoA.hora_inicio,
        hora_fin: turnoA.hora_fin,
        extras_estimados: extras
      });
    } else {
      if (!bDisponible) debug.descartes[uid] = 'sin disponibilidad ese día';
    }

    /* ---------- INTERCAMBIOS REALES (SIN CAMBIOS) ---------- */
    const turnosB = turnosByUser.get(uid) || [];
    const minsA = minutesBetween(turnoA.hora_inicio, turnoA.hora_fin);

    for (const tB of turnosB) {
      const aPuedeB = isAvailable(dispoMap, usuarioId, tB.fecha, tB.hora_inicio, tB.hora_fin);
      if (!aPuedeB) { debug.notas.push(`swap descartado A<->${uid}: A sin disponibilidad para la fecha destino`); continue; }

      if (!isAvailable(dispoMap, uid, turnoA.fecha, turnoA.hora_inicio, turnoA.hora_fin)) {
        debug.notas.push(`swap descartado A<->${uid}: B sin disponibilidad para la fecha destino`);
        continue;
      }

      if (sameDay(tB.fecha, turnoA.fecha) &&
          tB.hora_inicio === turnoA.hora_inicio &&
          tB.hora_fin === turnoA.hora_fin) {
        debug.notas.push(`swap descartado A<->${uid}: mismo día y mismo horario (intercambio trivial)`);
        continue;
      }

      const minsB = minutesBetween(tB.hora_inicio, tB.hora_fin);
      if (Math.abs(minsA - minsB) > TOL_MIN) {
        debug.notas.push(`swap descartado A<->${uid}: duraciones distintas (A ${minsA} vs B ${minsB} min)`); 
        continue;
      }

      const turnosA = turnosByUser.get(usuarioId) || [];
      const turnosDeB = turnosByUser.get(uid) || [];

      if (sameDay(tB.fecha, turnoA.fecha)) {
        const solapaA = turnosA.some(x =>
          x.id !== (turnoA.id || -1) &&
          sameDay(x.fecha, tB.fecha) &&
          !(x.hora_fin <= tB.hora_inicio || x.hora_inicio >= tB.hora_fin)
        );
        if (solapaA) { debug.notas.push(`swap descartado A<->${uid}: A quedaría solapado el ${tB.fecha}`); continue; }

        const solapaB = turnosDeB.some(x =>
          x.id !== tB.id &&
          sameDay(x.fecha, turnoA.fecha) &&
          !(x.hora_fin <= turnoA.hora_inicio || x.hora_inicio >= turnoA.hora_fin)
        );
        if (solapaB) { debug.notas.push(`swap descartado A<->${uid}: B quedaría solapado el ${turnoA.fecha}`); continue; }
      } else {
        const aTieneAlgoEnFechaB = hasOverlap(turnosA, tB.fecha, tB.hora_inicio, tB.hora_fin, null);
        if (aTieneAlgoEnFechaB) { debug.notas.push(`swap descartado A<->${uid}: A ya tiene turno el ${fmt(toDate(tB.fecha))}`); continue; }

        const bTieneAlgoEnFechaA = hasOverlap(turnosDeB, turnoA.fecha, turnoA.hora_inicio, turnoA.hora_fin, null);
        if (bTieneAlgoEnFechaA) { debug.notas.push(`swap descartado A<->${uid}: B ya tiene turno el ${fmt(toDate(turnoA.fecha))}`); continue; }
      }

      const key = `${uid}|${fmt(toDate(tB.fecha))}|${tB.hora_inicio}|${tB.hora_fin}`;
      if (vistosSwap.has(key)) continue;
      vistosSwap.add(key);

      let score = 50;
      if (sameDay(tB.fecha, turnoA.fecha)) score += 10;
      if (minsA === minsB) score += 5;

      const motivo = [];
      motivo.push(minsA === minsB ? 'Misma duración' : 'Duración similar');
      motivo.push('Ambos disponibles');
      if (sameDay(tB.fecha, turnoA.fecha)) motivo.push('Mismo día');
      if (Math.max(0, Math.round((horasSemana.get(uid) || 0) + (minsA/60) - (uInfo.horas_contrato || 0))) === 0) {
        motivo.push('Sin penalización de horas');
      }

      swaps.push({
        tipo: 'swap',
        usuario_id: uid,
        nombre: uInfo.nombre,
        score,
        motivo: motivo.join(' • '),
        intercambio: {
          fechaB: fmt(toDate(tB.fecha)),
          inicioB: tB.hora_inicio,
          finB: tB.hora_fin,
          turnoDestinoId: tB.id
        },
        turno_origen_id: turnoA.id,
        turno_destino_id: tB.id
      });
    }
  }

  swaps.sort((a,b) => b.score - a.score);
  coberturas.sort((a,b) => b.score - a.score);

  return { swaps, coberturas, debug };
}

module.exports = {
  recomendarIntercambioService,
};
