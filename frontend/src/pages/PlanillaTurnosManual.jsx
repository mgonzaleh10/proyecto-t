import React, { useState, useEffect, useCallback } from 'react'; // Importo React y hooks
import { Link } from 'react-router-dom'; // Importo Link para navegación
import html2canvas from 'html2canvas';   // Importo html2canvas para capturar tabla
import {
  crearTurno,
  updateTurno,
  eliminarTurno,
  getTurnosPorFecha,
  eliminarTodosTurnos,  // Importo para borrar todos los turnos
  enviarCalendario      // Importo la API para envío de correo
} from '../api/turnos';   // Importo API de turnos
import { getUsuarios } from '../api/usuarios'; // Importo API de usuarios
import { getDisponibilidades } from '../api/disponibilidades'; // Importo API de disponibilidades

import './PlanillaTurnosManual.css'; // Importo estilos

const DAY_LABELS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const FREE_KEY = 'freeMap'; // Clave para localStorage

// Función para convertir "HH:MM" a minutos
function parseTime(hm) {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
}

// Convierto "YYYY-MM-DD" a Date local
function parseLocalDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Obtengo array de fechas de lunes a domingo basado en baseDate
function getWeekDates(base) {
  const date = typeof base === 'string' ? parseLocalDate(base) : new Date(base);
  const day = date.getDay(); // 0=Dom
  const diffToMon = (day + 6) % 7; // Ajuste para lunes
  const monday = new Date(date);
  monday.setDate(date.getDate() - diffToMon);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function PlanillaTurnosManual() {
  // Estados
  const [baseDate,  setBaseDate]  = useState(new Date().toISOString().slice(0,10));
  const [weekDates, setWeekDates] = useState(getWeekDates(baseDate));
  const [crews,     setCrews]     = useState([]);
  const [cells,     setCells]     = useState({});
  const [editing,   setEditing]   = useState(false);
  const [disps,     setDisps]     = useState({});

  // 1) Cargo o recargo datos de turnos y estado 'free' al cambiar semana
  const loadData = useCallback(async () => {
    const all = [];
    for (const d of weekDates) {
      const fecha = d.toISOString().slice(0,10);
      try {
        const r = await getTurnosPorFecha(fecha);
        all.push(...r.data);
      } catch {}
    }
    // Construyo mapa de celdas con turnos existentes
    const m = {};
    all.forEach(t => {
      const idx = weekDates.findIndex(d => d.toISOString().slice(0,10) === t.fecha.slice(0,10));
      if (idx >= 0) {
        m[t.usuario_id] = m[t.usuario_id] || {};
        m[t.usuario_id][idx] = {
          id:     t.id,
          inicio: t.hora_inicio.slice(0,5),
          fin:    t.hora_fin.slice(0,5),
          free:   false
        };
      }
    });
    // Aplico estado 'free' desde localStorage
    const store = JSON.parse(localStorage.getItem(FREE_KEY) || '{}');
    Object.entries(store).forEach(([uid, fechas]) => {
      const crewId = Number(uid);
      fechas.forEach(fechaStr => {
        const idx = weekDates.findIndex(d => d.toISOString().slice(0,10) === fechaStr);
        if (idx >= 0) {
          m[crewId] = m[crewId] || {};
          m[crewId][idx] = { free: true };
        }
      });
    });
    setCells(m);
  }, [weekDates]);

  // 2) Cuando cambie baseDate, recalculo weekDates
  useEffect(() => {
    setWeekDates(getWeekDates(baseDate));
  }, [baseDate]);

  // 3) Recargo datos cuando cambian las fechas de la semana
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 4) Cargo la lista de usuarios (crews)
  useEffect(() => {
    getUsuarios().then(r => setCrews(r.data)).catch(console.error);
  }, []);

  // 5) Cargo disponibilidades para validar inputs
  useEffect(() => {
    getDisponibilidades()
      .then(r => {
        const m = {};
        r.data.forEach(d => {
          const dia = d.dia_semana.toLowerCase();
          m[d.usuario_id] = m[d.usuario_id] || {};
          m[d.usuario_id][dia] = {
            inicio: d.hora_inicio.slice(0,5),
            fin:    d.hora_fin.slice(0,5)
          };
        });
        setDisps(m);
      })
      .catch(console.error);
  }, []);

  // Alterno estado 'libre' y guardo en localStorage
  const toggleLibre = (crewId, dayIdx) => {
    setCells(prev => {
      const next = {
        ...prev,
        [crewId]: {
          ...prev[crewId],
          [dayIdx]: {
            ...(prev[crewId]?.[dayIdx] || {}),
            free: !prev[crewId]?.[dayIdx]?.free
          }
        }
      };
      const fecha = weekDates[dayIdx].toISOString().slice(0,10);
      const store = JSON.parse(localStorage.getItem(FREE_KEY) || '{}');
      const setFechas = new Set(store[crewId] || []);
      if (next[crewId][dayIdx].free) setFechas.add(fecha);
      else setFechas.delete(fecha);
      store[crewId] = Array.from(setFechas);
      localStorage.setItem(FREE_KEY, JSON.stringify(store));
      return next;
    });
  };

  // Cambio manual de inicio/fin en edición
  const handleCellChange = (crewId, dayIdx, field, val) => {
    setCells(prev => ({
      ...prev,
      [crewId]: {
        ...prev[crewId],
        [dayIdx]: {
          ...prev[crewId]?.[dayIdx],
          [field]: val,
          free: false
        }
      }
    }));
  };

  // Calculo horas trabajadas de un crew
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

  // Guardo todos los cambios en BD y recargo datos
  const saveAll = async () => {
    for (const crew of crews) {
      const row = cells[crew.id] || {};
      for (let i = 0; i < 7; i++) {
        const c = row[i];
        if (!c) continue;
        const payload = {
          fecha:       weekDates[i].toISOString().slice(0,10),
          hora_inicio: c.inicio,
          hora_fin:    c.fin,
          creado_por:  19,
          observaciones:''
        };
        if (c.free) {
          if (c.id) await eliminarTurno(c.id);
          continue;
        }
        if (c.inicio && c.fin) {
          if (c.id) await updateTurno(c.id, payload);
          else    await crearTurno({ ...payload, usuario_id: crew.id });
        }
      }
    }
    setEditing(false);
    await loadData();
  };

  // Genero resumen diario de cobertura y cierres
  const summary = weekDates.map((_, i) => {
    let total = 0, open = 0, close = 0;
    crews.forEach(c => {
      const ccell = cells[c.id]?.[i];
      if (ccell && !ccell.free && ccell.inicio && ccell.fin) {
        total++;
        if (ccell.fin === '23:30') close++;
        const startM = parseTime(ccell.inicio);
        if (startM >= parseTime('08:00') && startM <= parseTime('10:00')) {
          open++;
        }
      }
    });
    return { total, open, close };
  });

  // Manejador de envío por correo
  const handleSendEmail = async () => {
    if (!window.confirm(
      '¿Enviar la foto de esta planilla por correo a todos los crews listados?'
    )) {
      return;
    }
    try {
      const tableEl = document.querySelector('.planilla-table');
      const canvas = await html2canvas(tableEl);
      const imgData = canvas.toDataURL('image/png');

      const destinatarios = crews.map(u => u.correo);

      const htmlBody = `<h2>Planilla de Turnos - Semana del ${baseDate}</h2>
        <img src="${imgData}" alt="Planilla de Turnos" style="max-width:100%;" />`;

      await enviarCalendario({
        destinatarios,
        asunto: `Planilla de Turnos - Semana del ${baseDate}`,
        html: htmlBody
      });

      alert('Correos enviados correctamente.');
    } catch (err) {
      console.error('Error al enviar correos:', err);
      alert(err.response?.data?.error || err.message || 'Falló el envío de correos.');
    }
  };

  // Manejador de limpiar toda la tabla
  const handleClearTable = async () => {
    if (!window.confirm(
      '¿Seguro quieres borrar todos los turnos y los días libres asignados? Se reseteará la vista a solo disponibilidades.'
    )) {
      return;
    }
    try {
      // 1) Borro turnos en servidor
      await eliminarTodosTurnos();
      // 2) Borro estado free de localStorage
      localStorage.removeItem(FREE_KEY);
      // 3) Recargo datos
      setEditing(false);
      await loadData();
      alert('Tabla limpiada correctamente.');
    } catch (err) {
      console.error('Error al limpiar tabla:', err);
      alert('Falló al limpiar la tabla.');
    }
  };

  return (
    <div className="planilla-container">
      <h2>Calendario Manual de Turnos</h2>

      <div
        className="planilla-controls"
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div>
          {/* Botón para ir a la gestión de Crews */}
          <Link to="/usuarios">
            <button style={{ marginRight: '1rem' }}>Ir a Crews</button>
          </Link>

          {/* Selector de semana */}
          <label>
            Semana:
            <input
              type="date"
              value={baseDate}
              onChange={e => setBaseDate(e.target.value)}
              style={{ margin: '0 1rem' }}
            />
          </label>

          {/* Botón de editar/cancelar */}
          <button className="btn-edit" onClick={() => setEditing(!editing)}>
            {editing ? 'Cancelar' : 'Editar'}
          </button>

          {/* Botón de guardar (solo aparece en edición) */}
          {editing && (
            <button className="btn-save" onClick={saveAll} style={{ marginLeft: '1rem' }}>
              Guardar Cambios
            </button>
          )}
        </div>

        <div>
          {/* Botón de limpiar toda la tabla */}
          <button
            style={{ marginRight: '1rem', background: '#c00', color: '#fff' }}
            onClick={handleClearTable}
          >
            Limpiar tabla
          </button>

          {/* Botón de enviar por correo */}
          <button className="btn-email" onClick={handleSendEmail}>
            Enviar por correo
          </button>
        </div>
      </div>

      <table className="planilla-table">
        <thead>
          <tr>
            <th>Crew / Día</th>
            {weekDates.map((d, i) => (
              <th key={i}>
                {DAY_LABELS[i]}<br />{d.toLocaleDateString()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {crews.map(c => (
            <tr key={c.id}>
              <td className="first-col">
                {c.nombre} ({horasTrabajadas(c.id)}/{c.horas_contrato})
              </td>
              {weekDates.map((_, i) => {
                const cell    = cells[c.id]?.[i];
                const dayName = DAY_LABELS[i].toLowerCase();
                const avail   = disps[c.id]?.[dayName];
                const isAssigned = cell && !cell.free && cell.inicio && cell.fin;
                const isFree     = cell?.free;
                let className = '';
                if (isAssigned) className = 'assigned-cell';
                else if (isFree) className = 'free-cell';

                return (
                  <td key={i} className={className}>
                    {editing ? (
                      avail ? (
                        isFree ? (
                          <div className="free-cell-edit">
                            <button
                              className="btn-free edit-center"
                              onClick={() => toggleLibre(c.id, i)}
                            >
                              Libre
                            </button>
                          </div>
                        ) : (
                          <>
                            <input
                              type="time"
                              min={avail.inicio}
                              max={avail.fin}
                              value={cell?.inicio || ''}
                              onChange={e =>
                                handleCellChange(c.id, i, 'inicio', e.target.value)
                              }
                            />
                            –
                            <input
                              type="time"
                              min={avail.inicio}
                              max={avail.fin}
                              value={cell?.fin || ''}
                              onChange={e =>
                                handleCellChange(c.id, i, 'fin', e.target.value)
                              }
                            />
                            <button
                              className="btn-block"
                              onClick={() => toggleLibre(c.id, i)}
                            >
                              ⛔
                            </button>
                          </>
                        )
                      ) : (
                        <span className="not-available">No disponible</span>
                      )
                    ) : isFree ? (
                      <span className="free-label">Libre</span>
                    ) : isAssigned ? (
                      `${cell.inicio}–${cell.fin}`
                    ) : avail ? (
                      <span className="disp-range">
                        Disp {avail.inicio}–{avail.fin}
                      </span>
                    ) : (
                      <span className="not-available">No disponible</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Resumen</td>
            {summary.map(({ total, open, close }, i) => (
              <td key={i}>
                {total} (A:{open} C:{close})
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}