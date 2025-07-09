const db = require('../config/db');

// 1) Genera 7 fechas desde baseDate
function generarFechasSemana(baseDate) {
  const inicio = new Date(baseDate);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(inicio);
    d.setDate(inicio.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

// 2) Franjas horarias (incluye cierre a las 17:30)
const TIME_SLOTS = [
  '08:00','08:30','09:00','10:00','11:00',
  '12:00','13:00','14:30','15:00','16:30','17:30'
];

// 3) Duración según contrato y hora de inicio
function calcularDuracion(u, start) {
  const h = u.horas_contrato;
  if (h === 45) return 10;
  if (h === 30) {
    if (start === '08:30') return 9;
    if (start === '09:00') return 8;
    return 7;
  }
  if (h === 20) return 5;
  if (h === 16) return 8;
  return 0;
}

// 4) Reglas por contrato
const REGLAS = {
  45: { diasSemana: 5, domingosPorMes: 2 },
  30: { diasSemana: 5, domingosPorMes: 2 },
  20: { diasSemana: 4, domingosPorMes: 0 },
  16: { diasSemana: 2, soloDias: ['sábado','domingo'], domingosPorMes: 0 }
};
const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

// 5) Horas de cierre permitidas
const END_ALLOWED = new Set([
  '17:00','18:00','18:30','19:00','20:00','21:30','22:00','23:30'
]);

// 6) Chequea asignabilidad con todas las reglas
function puedeAsignar(uState, usuario, fecha, slot, dispMap, bensMap) {
  const bloqueos = [];
  const diaNombre = DIAS[new Date(fecha).getDay()];
  const disp = dispMap[usuario.id]?.[diaNombre];

  // 6.1. Un solo turno por día
  if (uState.asignadoHoy) {
    bloqueos.push('ya-asignado');
  }

  // 6.2. Disponibilidad
  if (!disp) {
    bloqueos.push('no-disp');
  } else if (disp.hora_inicio > slot || disp.hora_fin < slot) {
    bloqueos.push('fuera-horario');
  }

  // 6.3. Beneficio
  if (bensMap[usuario.id]?.has(fecha)) {
    bloqueos.push('tiene-beneficio');
  }

  // 6.4. Regla por contrato
  const regla = REGLAS[usuario.horas_contrato];
  if (!regla) {
    bloqueos.push('sin-regla-contrato');
    return false;
  }

  // 6.5. Solo ciertos días (para contrato 16h)
  if (regla.soloDias && !regla.soloDias.includes(diaNombre)) {
    bloqueos.push('soloDias');
  }

  // 6.6. Domingos por mes
  if (diaNombre === 'domingo' && uState.domingos >= regla.domingosPorMes) {
    bloqueos.push('max-domingos');
  }

  // 6.7. Días seguidos
  if (uState.ultFecha) {
    const diff = (new Date(fecha) - new Date(uState.ultFecha)) / 86400000;
    uState.consDias = diff === 1 ? uState.consDias + 1 : 1;
    if (uState.consDias > 6) bloqueos.push('max-seguidos');
  } else {
    uState.consDias = 1;
  }

  // 6.8. Máximo días/semana
  if (uState.diasPorSemana[0] >= regla.diasSemana) {
    bloqueos.push('max-dias-semana');
  }

  // 6.9. Horas semanales
  const dur = calcularDuracion(usuario, slot);
  if (uState.horasEstaSemana + dur > usuario.horas_contrato) {
    bloqueos.push('max-horas-semana');
  }

  // 6.10. Permiso de cerrar
  if ((slot === '16:30' || slot === '17:30') && !usuario.puede_cerrar) {
    bloqueos.push('no-puede-cerrar');
  }

  // 6.11. Duración válida
  if (dur === 0) {
    bloqueos.push('dur-0');
  }

  return bloqueos.length === 0;
}

// 7) Genera y graba turnos
async function generarTurnosAutomaticamente(baseDate) {
  const fechas = generarFechasSemana(baseDate);

  // Cargo datos
  const { rows: usuarios } = await db.query(
    'SELECT id, horas_contrato, puede_cerrar FROM usuarios'
  );
  const { rows: disponibilidades } = await db.query('SELECT * FROM disponibilidades');
  const { rows: beneficios } = await db.query('SELECT * FROM beneficios');

  // Índices
  const dispMap = {};
  disponibilidades.forEach(d => {
    dispMap[d.usuario_id] = dispMap[d.usuario_id] || {};
    dispMap[d.usuario_id][d.dia_semana] = d;
  });
  const bensMap = {};
  beneficios.forEach(b => {
    bensMap[b.usuario_id] = bensMap[b.usuario_id] || new Set();
    bensMap[b.usuario_id].add(b.fecha.toISOString().split('T')[0]);
  });

  // Estado inicial
  const estado = {};
  usuarios.forEach(u => {
    estado[u.id] = {
      consDias: 0,
      ultFecha: null,
      domingos: 0,
      diasPorSemana: [0],
      horasEstaSemana: 0,
      asignadoHoy: false
    };
  });

  const cierreCount = {};
  const turnos = [];

  for (const fecha of fechas) {
    // Reseteo diario
    Object.values(estado).forEach(s => s.asignadoHoy = false);
    cierreCount[fecha] = { '16:30': 0, '17:30': 0 };

    for (const slot of TIME_SLOTS) {
      for (const usuario of usuarios) {
        const uState = estado[usuario.id];
        if (!puedeAsignar(uState, usuario, fecha, slot, dispMap, bensMap)) {
          continue;
        }

        // Calculo fin y verificación 5)
        const dur = calcularDuracion(usuario, slot);
        const [h, m] = slot.split(':').map(Number);
        const finDate = new Date(2000,0,1,h,m);
        finDate.setHours(finDate.getHours() + dur);
        const fin = finDate.toTimeString().slice(0,5);
        if (!END_ALLOWED.has(fin)) continue;

        // Asigno turno
        turnos.push({
          usuario_id: usuario.id,
          fecha,
          hora_inicio: slot,
          hora_fin: fin,
          creado_por: 1,
          observaciones: ''
        });

        // Actualizo estado
        uState.ultFecha = fecha;
        uState.diasPorSemana[0]++;
        uState.horasEstaSemana += dur;
        uState.asignadoHoy = true;
        if (new Date(fecha).getDay() === 0) uState.domingos++;

        // 6) Cobertura de cierres
        if (slot === '16:30' || slot === '17:30') {
          cierreCount[fecha][slot]++;
          if (cierreCount[fecha][slot] >= 3) break;
        } else {
          break;
        }
      }
    }
  }

  // Grabo en la BD
  await db.query('TRUNCATE turnos RESTART IDENTITY CASCADE');
  for (const t of turnos) {
    await db.query(
      `INSERT INTO turnos(usuario_id,fecha,hora_inicio,hora_fin,creado_por,observaciones)
       VALUES($1,$2,$3,$4,$5,$6)`,
      [t.usuario_id, t.fecha, t.hora_inicio, t.hora_fin, t.creado_por, t.observaciones]
    );
  }

  return { generados: turnos.length, turnos };
}

module.exports = { generarTurnosAutomaticamente };