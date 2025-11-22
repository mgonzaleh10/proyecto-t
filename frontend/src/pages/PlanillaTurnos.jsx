// src/pages/PlanillaTurnos.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import html2canvas from 'html2canvas';
import {
  crearTurno,
  updateTurno,
  eliminarTurno,
  getTurnosPorFecha,
  eliminarTodosTurnos,
  enviarCalendario
} from '../api/turnos';
import { getUsuarios } from '../api/usuarios';
import { getDisponibilidades } from '../api/disponibilidades';
import { getBeneficios } from '../api/beneficios';

// Tema visual general (tiles, corner-id, etc.)
import './PlanillaTurnosManual.css';
// Estilos específicos SOLO para esta page
import './PlanillaTurnos.css';

const DAY_LABELS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const FREE_KEY   = 'freeMap';

/* ===== Helpers de fechas / horas ===== */
function parseLocalDate(ymd) {
  const [y,m,d] = ymd.split('-').map(Number);
  return new Date(y, m-1, d);
}
function fmtYMD(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const dd= String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}
function getWeekDates(base) {
  const date = typeof base==='string' ? parseLocalDate(base) : new Date(base);
  const diff = (date.getDay()+6)%7;
  const mon = new Date(date);
  mon.setDate(date.getDate()-diff);
  return Array.from({ length:7 }, (_,i)=>{
    const d = new Date(mon);
    d.setDate(mon.getDate()+i);
    return d;
  });
}
function parseTime(hm) {
  const [h,m] = hm.split(':').map(Number);
  return h*60 + m;
}
function addDays(d, n){
  const nd = new Date(d);
  nd.setDate(nd.getDate()+n);
  return nd;
}
function diffDays(start, end){
  const ms = end - start;
  return Math.round(ms / (1000*60*60*24));
}
function fmtDMY(ymd){
  const [y,m,d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

export default function PlanillaTurnos() {
  const [baseDate, setBaseDate]     = useState(new Date().toISOString().slice(0,10));
  const [weekDates, setWeekDates]   = useState(getWeekDates(baseDate));
  const [crews, setCrews]           = useState([]);
  const [crewSel, setCrewSel]       = useState('');
  const [inputs, setInputs]         = useState({});
  const [cells, setCells]           = useState({});
  const [disps, setDisps]           = useState({});
  const [benefits, setBenefits]     = useState({});

  // Advertencias por usuario: { [usuarioId]: [{start, end}, ...] }
  const [warningMap, setWarningMap] = useState({});

  /* ==================== CARGAS INICIALES ==================== */

  useEffect(()=>{
    getUsuarios().then(r=>setCrews(r.data)).catch(console.error);
  },[]);

  useEffect(()=>{
    getDisponibilidades().then(r=>{
      const mp = {};
      r.data.forEach(d=>{
        const day = d.dia_semana.toLowerCase();
        mp[d.usuario_id] = mp[d.usuario_id]||{};
        mp[d.usuario_id][day] = {
          inicio: String(d.hora_inicio).slice(0,5),
          fin:    String(d.hora_fin).slice(0,5)
        };
      });
      setDisps(mp);
    }).catch(console.error);
  },[]);

  useEffect(()=>{
    getBeneficios().then(r=>{
      const mp = {};
      r.data.forEach(b=>{
        const f = String(b.fecha).slice(0,10);
        mp[b.usuario_id] = mp[b.usuario_id]||{};
        mp[b.usuario_id][f] = b.tipo;
      });
      setBenefits(mp);
    }).catch(console.error);
  },[]);

  // cuando cambia la fecha base, recalculo semana y limpio inputs
  useEffect(()=>{
    setWeekDates(getWeekDates(baseDate));
    setInputs({});
  },[baseDate]);

  /* ==================== CARGAR TURNOS + LIBRES ==================== */

  const loadData = useCallback(async ()=>{
    const all = [];
    for(const d of weekDates){
      const f = fmtYMD(d);
      try {
        const r = await getTurnosPorFecha(f);
        all.push(...r.data);
      } catch {
        // ignore
      }
    }

    const m = {};
    all.forEach(t=>{
      const fecha = String(t.fecha).slice(0,10);
      const idx = weekDates.findIndex(dd => fmtYMD(dd) === fecha);
      if(idx < 0) return;
      m[t.usuario_id] = m[t.usuario_id] || {};
      m[t.usuario_id][idx] = {
        id:     t.id,
        inicio: String(t.hora_inicio).slice(0,5),
        fin:    String(t.hora_fin).slice(0,5),
        free:   false
      };
    });

    // aplicar mapa de días libres desde localStorage
    const store = JSON.parse(localStorage.getItem(FREE_KEY) || '{}');
    Object.entries(store).forEach(([uid, dates])=>{
      const u = Number(uid);
      dates.forEach(ds=>{
        const idx = weekDates.findIndex(dd => fmtYMD(dd) === ds);
        if (idx >= 0) {
          m[u] = m[u] || {};
          const prev = m[u][idx] || {};
          m[u][idx] = { ...prev, free: true };
        }
      });
    });

    setCells(m);
  },[weekDates]);

  useEffect(()=>{ loadData(); },[loadData]);

  /* ==================== ADVERTENCIAS (>6 días seguidos) ==================== */

  const recomputeWarnings = useCallback(async () => {
    if (!weekDates.length || !crews.length) {
      setWarningMap({});
      return;
    }

    const monday = weekDates[0];
    const start  = addDays(monday, -7);   // lunes anterior
    const totalDays = 21;                 // semana anterior, actual y siguiente
    const dates = Array.from({ length: totalDays }, (_, i) => addDays(start, i));
    const ymdList = dates.map(fmtYMD);

    const workMap = {};

    try {
      const responses = await Promise.all(
        ymdList.map(async (ymd) => {
          try {
            const r = await getTurnosPorFecha(ymd);
            return { ymd, data: r.data || [] };
          } catch {
            return { ymd, data: [] };
          }
        })
      );

      responses.forEach(({ ymd, data }) => {
        data.forEach(t => {
          const crewId = t.usuario_id;
          const fecha  = String(t.fecha).slice(0,10);
          if (fecha !== ymd) return;
          if (!t.hora_inicio || !t.hora_fin) return;
          workMap[crewId] = workMap[crewId] || {};
          workMap[crewId][fecha] = true;
        });
      });

      // Aplicar libres manuales (rompen racha)
      const store = JSON.parse(localStorage.getItem(FREE_KEY) || '{}');
      Object.entries(store).forEach(([uidStr, fechas]) => {
        const uid = Number(uidStr);
        fechas.forEach(f => {
          if (!ymdList.includes(f)) return;
          workMap[uid] = workMap[uid] || {};
          workMap[uid][f] = false;
        });
      });

      // Beneficios tampoco cuentan como trabajo
      crews.forEach(c => {
        const uid = c.id;
        ymdList.forEach(f => {
          if (benefits[uid]?.[f]) {
            if (workMap[uid]) workMap[uid][f] = false;
          }
        });
      });

      const weekStart = fmtYMD(weekDates[0]);
      const weekEnd   = fmtYMD(weekDates[6]);

      const result = {};

      crews.forEach(c => {
        const uid = c.id;
        let ranges = [];
        let runStart = null;
        let prevDate = null;

        dates.forEach((d, idx) => {
          const ymd = ymdList[idx];
          const isWork = !!workMap[uid]?.[ymd];

          if (isWork) {
            if (runStart === null) {
              runStart = ymd;
            }
          } else {
            if (runStart !== null) {
              const startY = runStart;
              const endY   = fmtYMD(prevDate);
              const len    = diffDays(parseLocalDate(startY), parseLocalDate(endY)) + 1;
              if (len > 6) ranges.push({ start: startY, end: endY });
              runStart = null;
            }
          }
          prevDate = d;
        });

        if (runStart !== null) {
          const startY = runStart;
          const endY   = fmtYMD(dates[dates.length - 1]);
          const len    = diffDays(parseLocalDate(startY), parseLocalDate(endY)) + 1;
          if (len > 6) ranges.push({ start: startY, end: endY });
        }

        const overlapped = ranges.filter(r => !(r.end < weekStart || r.start > weekEnd));
        if (overlapped.length) {
          result[uid] = overlapped;
        }
      });

      setWarningMap(result);
    } catch (e) {
      console.error('Error calculando advertencias:', e);
      setWarningMap({});
    }
  }, [weekDates, crews, benefits]);

  // Recalcular cuando cambie semana / crews / beneficios
  useEffect(() => {
    recomputeWarnings();
  }, [recomputeWarnings]);

  /* ==================== PREFILL AL CAMBIAR CREW ==================== */

  useEffect(()=>{
    if (!crewSel) {
      setInputs({});
      return;
    }
    const by = cells[crewSel] || {};
    const ni = {};
    weekDates.forEach((_, i)=>{
      const c = by[i];
      if (c) {
        ni[i] = {
          inicio: c.inicio || '',
          fin:    c.fin || '',
          free:   !!c.free,
          id:     c.id
        };
      }
    });
    setInputs(ni);
  },[crewSel, cells, weekDates]);

  /* ==================== EDICIÓN DE LA SEMANA ==================== */

  const toggleLibre = i => {
    setInputs(prev=>{
      const cur = prev[i] || {};
      return {
        ...prev,
        [i]: {
          ...cur,
          free: !cur.free,
          inicio: !cur.free ? '' : cur.inicio,
          fin:    !cur.free ? '' : cur.fin
        }
      };
    });
  };

  const handleInput = (i, field, val) => {
    setInputs(prev=>({
      ...prev,
      [i]: { ...(prev[i]||{}), [field]: val, free: false }
    }));
  };

  const handleSubmit = async () => {
    if (!crewSel) {
      alert('Selecciona primero un crew.');
      return;
    }

    const store   = JSON.parse(localStorage.getItem(FREE_KEY) || '{}');
    const freeSet = new Set(store[crewSel] || {});

    for (let i = 0; i < 7; i++) {
      const dat = inputs[i] || {};
      const f   = fmtYMD(weekDates[i]);

      // beneficio → no se graba turno ni libre
      if (benefits[crewSel]?.[f]) {
        freeSet.delete(f);
        continue;
      }

      // marcado como libre
      if (dat.free) {
        freeSet.add(f);
        if (dat.id) await eliminarTurno(dat.id);
        continue;
      }
      if (freeSet.has(f)) freeSet.delete(f);

      // sin datos, elimino turno existente
      if (!dat.inicio && !dat.fin) {
        if (dat.id) await eliminarTurno(dat.id);
        continue;
      }

      // validar contra disponibilidad
      const avail = disps[crewSel]?.[DAY_LABELS[i].toLowerCase()];
      if (!avail ||
          parseTime(dat.inicio) < parseTime(avail.inicio) ||
          parseTime(dat.fin)    > parseTime(avail.fin)
      ) {
        alert(`No disponible el ${DAY_LABELS[i]} (${avail?.inicio || '--'}–${avail?.fin || '--'})`);
        continue;
      }

      const payload = {
        fecha:       f,
        hora_inicio: dat.inicio,
        hora_fin:    dat.fin,
        creado_por:  19,
        observaciones: ''
      };

      if (dat.id) await updateTurno(dat.id, payload);
      else        await crearTurno({ usuario_id: +crewSel, ...payload });
    }

    store[crewSel] = Array.from(freeSet);
    localStorage.setItem(FREE_KEY, JSON.stringify(store));

    await loadData();
    await recomputeWarnings();  // actualizar iconos
    alert('Turnos procesados.');
  };

  /* ==================== LIMPIAR Y ENVIAR ==================== */

  const handleClearAll = async () => {
    if (!window.confirm('¿Borrar todos los turnos y libres?')) return;
    await eliminarTodosTurnos();
    localStorage.removeItem(FREE_KEY);
    setInputs({});
    await loadData();
    await recomputeWarnings();
    alert('Tabla limpiada.');
  };

  const handleSend = async () => {
    if (!window.confirm('¿Enviar planilla?')) return;
    const tableEl = document.querySelector('.crew-input-table-wrap');
    const canvas  = await html2canvas(tableEl);
    const img     = canvas.toDataURL('image/png');
    const dst     = crews.map(u => u.correo);
    await enviarCalendario({
      destinatarios: dst,
      asunto: `Planilla ${baseDate}`,
      html: `<h2>Planilla de Turnos - ${baseDate}</h2><img src="${img}" style="max-width:100%;" />`
    });
    alert('Correo enviado.');
  };

  /* ==================== RESUMEN SEMANAL ==================== */

  const horasTrabajadas = crewId => {
    const row = cells[crewId] || {};
    let total = 0;
    Object.values(row).forEach(c => {
      if (c && !c.free && c.inicio && c.fin) {
        const mins = parseTime(c.fin) - parseTime(c.inicio);
        total += Math.max(0, mins/60 - 1);
      }
    });
    return +total.toFixed(1);
  };

  const summary = weekDates.map((_, i)=>{
    let tot = 0, op = 0, cl = 0;
    crews.forEach(c=>{
      const t = cells[c.id]?.[i];
      if (t && !t.free && t.inicio && t.fin) {
        tot++;
        if (t.fin === '23:30') cl++;
        const sm = parseTime(t.inicio);
        if (sm >= parseTime('08:00') && sm <= parseTime('10:00')) op++;
      }
    });
    return { total: tot, open: op, close: cl };
  });

  /* ==================== RENDER ==================== */

  return (
    <div className="planilla-screen">
      {/* Cabecera tipo poster */}
      <div className="poster-head">
        <h1>PLANILLA DE TURNOS</h1>
        <p className="sub">Carga semanal por crew</p>
      </div>

      {/* Toolbar superior */}
      <div className="toolbar">
        <div className="left">
          <Link to="/usuarios">
            <button className="bk-btn ghost">← Ir a Crews</button>
          </Link>

          {/* Selector de crew (combo) */}
          <label className="week-picker">
            <span>Crew:</span>
            <select
              value={crewSel}
              onChange={e => setCrewSel(e.target.value)}
            >
              <option value="">-- selecciona --</option>
              {crews.map(u => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          </label>

          {/* Semana */}
          <label className="week-picker">
            <span>Semana:</span>
            <input
              type="date"
              value={baseDate}
              onChange={e => setBaseDate(e.target.value)}
            />
          </label>

          <button
            onClick={handleSubmit}
            className="bk-btn primary"
          >
            Crear/Actualizar
          </button>
        </div>

        <div className="right">
          <button
            onClick={handleClearAll}
            className="bk-btn danger"
          >
            Limpiar tabla
          </button>
          <button
            onClick={handleSend}
            className="bk-btn info"
          >
            Enviar por correo
          </button>
        </div>
      </div>

      {/* BLOQUE: carga semanal de un solo crew */}
      <div className="planilla-table-wrap crew-input-table-wrap">
        <table className="crew-input-table">
          <thead>
            <tr>
              <th>Día</th>
              <th>Fecha</th>
              <th>Inicio</th>
              <th>Fin</th>
              <th>Libre</th>
            </tr>
          </thead>
          <tbody>
            {weekDates.map((d, i) => {
              const f      = fmtYMD(d);
              const tipo   = benefits[crewSel]?.[f];
              const dat    = inputs[i] || {};
              const isFree = !!dat.free;
              const avail  = disps[crewSel]?.[DAY_LABELS[i].toLowerCase()];

              // Día con beneficio
              if (tipo) {
                return (
                  <tr key={i} className="row-benefit">
                    <td>
                      <div className="crew-day-pill">{DAY_LABELS[i]}</div>
                    </td>
                    <td>
                      <div className="crew-date-cell">
                        <span className="crew-date-main">
                          {d.toLocaleDateString()}
                        </span>
                        <span className="crew-date-sub">
                          Beneficio asignado
                        </span>
                      </div>
                    </td>
                    <td colSpan={3} className="cell-benefit">
                      {tipo}
                    </td>
                  </tr>
                );
              }

              // Día normal
              return (
                <tr key={i} className={isFree ? 'row-free' : ''}>
                  <td>
                    <div className="crew-day-pill">{DAY_LABELS[i]}</div>
                  </td>
                  <td>
                    <div className="crew-date-cell">
                      <span className="crew-date-main">
                        {d.toLocaleDateString()}
                      </span>
                      {isFree ? (
                        <span className="crew-date-sub crew-date-sub--free">
                          Día marcado como libre
                        </span>
                      ) : (
                        avail && (
                          <span className="crew-date-sub">
                            Disp {avail.inicio} — {avail.fin}
                          </span>
                        )
                      )}
                    </div>
                  </td>
                  <td>
                    <input
                      type="time"
                      disabled={isFree}
                      value={dat.inicio || ''}
                      onChange={e => handleInput(i,'inicio',e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="time"
                      disabled={isFree}
                      value={dat.fin || ''}
                      onChange={e => handleInput(i,'fin',e.target.value)}
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="mini btn-free-crew"
                      onClick={() => toggleLibre(i)}
                    >
                      {isFree ? '✘ Libre' : 'Libre'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* BLOQUE: resumen semanal (mismo look que la planilla manual) */}
      <div className="planilla-table-wrap">
        <table className="planilla-table planilla-summary">
          <thead>
            <tr>
              <th className="col-emp">Crew / Día</th>
              {weekDates.map((_, i) => (
                <th key={i}>
                  <div className="day-head">
                    <span className="day">{DAY_LABELS[i]}</span>
                    <span className="date">
                      {weekDates[i].toLocaleDateString()}
                    </span>
                  </div>
                </th>
              ))}
              {/* Columna extra sin encabezado visible (advertencias) */}
              <th className="warn-col" aria-label="Advertencias de días consecutivos" />
            </tr>
          </thead>
          <tbody>
            {crews.map(c => (
              <tr key={c.id}>
                <td className="emp-cell">
                  <span className="emp-name">{c.nombre}</span>
                  <span className="emp-badge">
                    {horasTrabajadas(c.id)}/{c.horas_contrato}
                  </span>
                  {/* ID de usuario en la esquina, igual que en planilla manual */}
                  <button
                    type="button"
                    className="corner-id"
                    title={`Usuario ID: ${c.id}`}
                  >
                    i
                  </button>
                </td>
                {weekDates.map((_, i) => {
                  const f    = fmtYMD(weekDates[i]);
                  const tipo = benefits[c.id]?.[f];

                  if (tipo) {
                    return (
                      <td key={i} className="tile tile--benefit">
                        <span className="label">{tipo}</span>
                      </td>
                    );
                  }

                  const t     = cells[c.id]?.[i];
                  const avail = disps[c.id]?.[DAY_LABELS[i].toLowerCase()];
                  const assigned = t && !t.free && t.inicio && t.fin;
                  const free     = t?.free;

                  if (free) {
                    return (
                      <td key={i} className="tile tile--free">
                        <span className="time-row">LIBRE</span>
                      </td>
                    );
                  }
                  if (assigned) {
                    return (
                      <td key={i} className="tile tile--shift">
                        <span className="time-row">
                          {t.inicio} — {t.fin}
                        </span>
                        {t.id && (
                          <button
                            type="button"
                            className="corner-id"
                            title={`Turno ID: ${t.id}`}
                          >
                            i
                          </button>
                        )}
                      </td>
                    );
                  }
                  if (avail) {
                    return (
                      <td key={i} className="tile tile--disp">
                        <span className="time-row">
                          Disp {avail.inicio} — {avail.fin}
                        </span>
                      </td>
                    );
                  }
                  return (
                    <td key={i} className="tile tile--na">
                      <span className="label">No disponible</span>
                    </td>
                  );
                })}

                {/* Celda de advertencias lateral */}
                <td className="warn-cell">
                  {warningMap[c.id]?.length > 0 && (
                    <span
                      className="warn-icon"
                      title={
                        warningMap[c.id]
                          .map(r =>
                            `Más de 6 días consecutivos trabajados entre ${fmtDMY(r.start)} y ${fmtDMY(r.end)}`
                          )
                          .join('\n')
                      }
                    >
                      !
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="emp-cell foot">Resumen</td>
              {summary.map((s, i) => (
                <td key={i} className="tile tile--foot">
                  <span className="foot-line">{s.total}</span>
                  <span className="foot-mini">
                    A:{s.open} • C:{s.close}
                  </span>
                </td>
              ))}
              {/* Celda vacía para alinear columna de advertencias */}
              <td className="warn-cell foot" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
