// src/services/recomendacionesHorarios.js (CommonJS)

// Pool: en tu db.js exportas el pool directamente con `module.exports = pool`
const pool = require('../config/db.js');

// ===== Config =====
const DEBUG = true;          // <- pon en false si no quieres ver "debug.descartes"
const TOLERANCIA_MIN = 30;   // minutos de flexibilidad en disponibilidad (±)

// ===== Utilidades =====
const parseHM = (hm) => {
  const [h, m] = String(hm).split(':').map(Number);
  return h * 60 + (m || 0);
};
const toYMD = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
};
// Normaliza tildes y minúsculas (miércoles → miercoles)
const normalize = (str) =>
  String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const DAY_LABELS = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];

const weekdayIdx = (dateStr) => {
  // 0=Lunes ... 6=Domingo
  const d = new Date(dateStr + 'T00:00:00');
  return (d.getDay() + 6) % 7;
};
const dayLabelFromDate = (dateStr) => DAY_LABELS[weekdayIdx(dateStr)];

// Lunes y domingo de la semana de una fecha YYYY-MM-DD
const weekRange = (ymd) => {
  const d = new Date(ymd + 'T00:00:00');
  const diff = (d.getDay() + 6) % 7;
  const mon = new Date(d); mon.setDate(d.getDate() - diff);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { monday: toYMD(mon), sunday: toYMD(sun) };
};

const overlaps = (aS,aE,bS,bE) => Math.max(parseHM(aS),parseHM(bS)) < Math.min(parseHM(aE),parseHM(bE));
const isClosing = (fin) => String(fin).slice(0,5) === '23:30';
// Duración efectiva en horas (resto 1 hora colación como en tu planilla)
const durHoras  = (ini,fin) => Math.max(0, (parseHM(fin)-parseHM(ini))/60 - 1);

// ===== Acceso a datos =====
async function getTurnoById(turnoId) {
  const { rows } = await pool.query(`SELECT * FROM turnos WHERE id = $1`, [turnoId]);
  return rows[0];
}
async function getUsuariosExcept(exceptId) {
  const { rows } = await pool.query(`SELECT * FROM usuarios WHERE id <> $1 ORDER BY id`, [exceptId]);
  return rows;
}
async function getUserById(uid) {
  const { rows } = await pool.query(`SELECT * FROM usuarios WHERE id = $1`, [uid]);
  return rows[0];
}
async function getDisponibilidades() {
  // Mapa: disp[usuario_id][dia_norm] = { inicio, fin }
  const { rows } = await pool.query(`SELECT * FROM disponibilidades`);
  const map = {};
  rows.forEach(r => {
    const dayNorm = normalize(r.dia_semana);
    (map[r.usuario_id] ||= {})[dayNorm] = {
      inicio: String(r.hora_inicio).slice(0,5),
      fin:    String(r.hora_fin).slice(0,5),
    };
  });
  return map;
}
async function getBeneficiosMap() {
  // beneficios[usuario_id][ymd] = tipo
  const { rows } = await pool.query(`SELECT usuario_id, tipo, fecha FROM beneficios`);
  const map = {};
  rows.forEach(b => {
    const ymd = String(b.fecha).slice(0,10);
    (map[b.usuario_id] ||= {})[ymd] = b.tipo;
  });
  return map;
}
async function getLicenciasRangoMap() {
  // licencias[usuario_id][ymd] = true
  const { rows } = await pool.query(`SELECT usuario_id, fecha_inicio, fecha_fin FROM licencias`);
  const map = {};
  rows.forEach(l => {
    const start = new Date(String(l.fecha_inicio).slice(0,10)+'T00:00:00');
    const end   = new Date(String(l.fecha_fin).slice(0,10)+'T00:00:00');
    for (let d=new Date(start); d<=end; d.setDate(d.getDate()+1)) {
      const ymd = toYMD(d);
      (map[l.usuario_id] ||= {})[ymd] = true;
    }
  });
  return map;
}
async function getTurnosSemanaMap(monday, sunday) {
  // turnosSemana[usuario_id][ymd] = [{ id, inicio, fin }]
  const { rows } = await pool.query(`
    SELECT * FROM turnos
     WHERE fecha BETWEEN $1 AND $2
     ORDER BY fecha, hora_inicio
  `, [monday, sunday]);
  const map = {};
  rows.forEach(t => {
    const uid = t.usuario_id;
    const ymd = String(t.fecha).slice(0,10);
    (((map[uid] ||= {})[ymd]) ||= []).push({
      id: t.id,
      inicio: String(t.hora_inicio).slice(0,5),
      fin:    String(t.hora_fin).slice(0,5),
    });
  });
  return map;
}

// ===== Scoring =====
function scoreSwap({sameContract, fitsBlocks, similarDuration, overHours}) {
  let s = 10; // bonus por ser swap (intercambio real)
  if (fitsBlocks)      s += 8;
  if (sameContract)    s += 5;
  if (similarDuration) s += 3;
  if (overHours > 0)   s -= 5 * overHours; // penalización simple por sobrehoras
  return s;
}
function scoreCover({fitsBlocks, sameContract, overHours}) {
  let s = 0;
  if (fitsBlocks)   s += 8;
  if (sameContract) s += 5;
  if (overHours>0)  s -= 5 * overHours;
  return s;
}

// ===== Servicio principal =====
async function recomendarIntercambioService({ usuarioId, turnoOrigenId=null, fecha, hora_inicio, hora_fin }) {
  const { monday, sunday } = weekRange(fecha);

  const [disp, ben, lic, turnosSemana, usuarios, userA] = await Promise.all([
    getDisponibilidades(),
    getBeneficiosMap(),
    getLicenciasRangoMap(),
    getTurnosSemanaMap(monday, sunday),
    getUsuariosExcept(usuarioId),
    getUserById(usuarioId)
  ]);

  const turnoA = turnoOrigenId ? await getTurnoById(turnoOrigenId)
                               : { id:null, usuario_id:usuarioId, fecha, hora_inicio, hora_fin };

  // 1) Regla: no permitir acción si el turno ya inició (o es demasiado próximo)
  const now = new Date();
  const startA = new Date(`${fecha}T${String(hora_inicio).slice(0,5)}:00`);
  if (now >= startA) {
    return { swaps: [], coberturas: [], motivoBloqueo: 'El turno ya fue iniciado o está muy próximo.' };
  }

  // 2) Contexto
  const esCierre = isClosing(hora_fin);
  const durA = durHoras(hora_inicio, hora_fin);
  const dayLabelA = dayLabelFromDate(fecha); // normalizado
  const swaps = [];
  const covers = [];
  const descartes = {}; // uidB -> motivo (DEBUG)

  // 3) Iteración por candidatos
  for (const userB of usuarios) {
    const uidB = userB.id;

    // Día bloqueado por beneficio/licencia
    if (ben[uidB]?.[fecha] || lic[uidB]?.[fecha]) { descartes[uidB] = 'beneficio/licencia en el día'; continue; }

    // Disponibilidad de B en día de A
    const dB = disp[uidB]?.[dayLabelA];
    if (!dB) { descartes[uidB] = 'sin disponibilidad ese día'; continue; }

    // Permitir ±TOLERANCIA_MIN de diferencia con la franja
    if ((parseHM(dB.inicio) - TOLERANCIA_MIN) > parseHM(hora_inicio) ||
        (parseHM(dB.fin)   + TOLERANCIA_MIN) < parseHM(hora_fin)) {
      descartes[uidB] = `no cubre rango (disp ${dB.inicio}-${dB.fin} vs turno ${hora_inicio}-${hora_fin})`;
      continue;
    }

    // Cierre → requiere puede_cerrar
    if (esCierre && !userB.puede_cerrar) { descartes[uidB] = 'cierre y B no puede_cerrar'; continue; }

    // B ya tiene turnos ese día de A?
    const turnosB_enDiaA = (turnosSemana[uidB]?.[fecha]) || [];
    const solapa = turnosB_enDiaA.some(t => overlaps(hora_inicio, hora_fin, t.inicio, t.fin));

    // 4) Intento SWAP: buscar un turno de B otro día que A NO trabaje y A pueda cubrir
    let posibleSwap = null;
    for (const ymd of Object.keys(turnosSemana[uidB] || {})) {
      if (ymd === fecha) continue; // evitamos mismo día (swap entre días distintos)
      const A_tieneTurnoEseDia = (turnosSemana[usuarioId]?.[ymd] || []).length > 0;
      if (A_tieneTurnoEseDia) continue;

      const dayLabelSwap = dayLabelFromDate(ymd);
      const dispA = disp[usuarioId]?.[dayLabelSwap];
      if (!dispA) continue;

      for (const tb of (turnosSemana[uidB][ymd] || [])) {
        if (ben[usuarioId]?.[ymd] || lic[usuarioId]?.[ymd]) continue;

        // A debe cubrir el turno de B con tolerancia
        if ((parseHM(dispA.inicio) - TOLERANCIA_MIN) > parseHM(tb.inicio) ||
            (parseHM(dispA.fin)   + TOLERANCIA_MIN) < parseHM(tb.fin)) {
          continue;
        }
        // Si el turno de B es cierre, A debe poder cerrar
        if (isClosing(tb.fin) && !userA.puede_cerrar) continue;

        posibleSwap = { ymd, turnoB: tb };
        break;
      }
      if (posibleSwap) break;
    }

    // 5) Scoring
    const sameContract = Number(userB.horas_contrato) === Number(userA.horas_contrato);

    const totalHorasSemanaB = Object.values(turnosSemana[uidB] || {}).flat()
      .reduce((acc, t) => acc + durHoras(t.inicio, t.fin), 0);

    let overHours = 0;
    if (posibleSwap) {
      const durSwap = durHoras(posibleSwap.turnoB.inicio, posibleSwap.turnoB.fin);
      const diff = (totalHorasSemanaB - durSwap + durA) - Number(userB.horas_contrato || 0);
      if (diff > 0) overHours = Math.ceil(diff);
    } else {
      const diff = (totalHorasSemanaB + durA) - Number(userB.horas_contrato || 0);
      if (diff > 0) overHours = Math.ceil(diff);
    }

    const fitsBlocks = true; // Hook para dotación/bloques (si lo integras después)
    const similarDuration = posibleSwap
      ? Math.abs(durHoras(posibleSwap.turnoB.inicio, posibleSwap.turnoB.fin) - durA) <= 1
      : false;

    // 6) Ensamblado de respuestas
    if (posibleSwap) {
      swaps.push({
        usuario_id: uidB,
        nombre: userB.nombre,
        tipo: 'swap',
        score: scoreSwap({ sameContract, fitsBlocks, similarDuration, overHours }),
        motivo: [
          'Intercambio real posible',
          sameContract ? 'Mismo contrato' : null,
          similarDuration ? 'Duración similar' : null,
          overHours>0 ? `Penalización horas +${overHours}` : null,
        ].filter(Boolean).join(' • '),
        intercambio: {
          fechaA: fecha, inicioA: hora_inicio, finA: hora_fin,
          fechaB: posibleSwap.ymd,
          inicioB: posibleSwap.turnoB.inicio, finB: posibleSwap.turnoB.fin,
          turnoDestinoId: posibleSwap.turnoB.id
        }
      });
    } else if (!solapa) {
      // Cobertura solo si NO se solapa con un turno que ya tenga ese día
      covers.push({
        usuario_id: uidB,
        nombre: userB.nombre,
        tipo: 'cobertura',
        score: scoreCover({ fitsBlocks, sameContract, overHours }),
        motivo: [
          'Puede cubrir ese día',
          sameContract ? 'Mismo contrato' : null,
          overHours>0 ? `Penalización horas +${overHours}` : null,
        ].filter(Boolean).join(' • ')
      });
    } else {
      // Sin swap y con solape: descartado
      descartes[uidB] = 'tiene turno solapado ese día';
    }
  }

  // 7) Orden
  swaps.sort((a,b)=> b.score - a.score);
  covers.sort((a,b)=> b.score - a.score);

  // 8) Respuesta
  const resp = {
    swaps: swaps.slice(0,10),
    coberturas: covers.slice(0,10),
  };
  if (DEBUG) resp.debug = { descartes };
  return resp;
}

module.exports = {
  recomendarIntercambioService,
};
