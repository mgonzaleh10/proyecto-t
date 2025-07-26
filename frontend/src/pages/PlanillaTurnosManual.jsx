import React, { useState, useEffect, useCallback } from 'react'; // Importo React y hooks
import { Link } from 'react-router-dom';                      // Importo Link para navegación
import html2canvas from 'html2canvas';                        // Importo html2canvas para capturar tabla
import {
  crearTurno,
  updateTurno,
  eliminarTurno,
  getTurnosPorFecha,
  eliminarTodosTurnos,
  enviarCalendario
} from '../api/turnos';                                      // Importo API de turnos
import { getUsuarios } from '../api/usuarios';               // Importo API de usuarios
import { getDisponibilidades } from '../api/disponibilidades'; // Importo API de disponibilidades
import { getBeneficios } from '../api/beneficios';           // Importo API de beneficios

import './PlanillaTurnosManual.css'; // Importo estilos

const DAY_LABELS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const FREE_KEY   = 'freeMap';         // Clave para localStorage

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
  const diff = (date.getDay() + 6) % 7; // Ajuste para lunes como inicio
  const mon  = new Date(date);
  mon.setDate(date.getDate() - diff);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
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
  // Ahora benefits mapea usuario_id → { 'YYYY-MM-DD': tipo }
  const [benefits,  setBenefits]  = useState({});

  // 1) Cargo crews
  useEffect(() => {
    getUsuarios().then(r => setCrews(r.data)).catch(console.error);
  }, []);

  // 2) Cargo disponibilidades
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

  // 3) Cargo beneficios con su tipo
  useEffect(() => {
    getBeneficios()
      .then(r => {
        const m = {};
        r.data.forEach(b => {
          const f = b.fecha.slice(0,10);
          m[b.usuario_id] = m[b.usuario_id] || {};
          m[b.usuario_id][f] = b.tipo;  // 'cumpleaños', 'administrativo' o 'vacaciones'
        });
        setBenefits(m);
      })
      .catch(console.error);
  }, []);

  // 4) Recalculo fechas de la semana al cambiar baseDate
  useEffect(() => {
    setWeekDates(getWeekDates(baseDate));
  }, [baseDate]);

  // 5) Cargo turnos + estado 'free' en la tabla
  const loadData = useCallback(async () => {
    const all = [];
    for (const d of weekDates) {
      const fecha = d.toISOString().slice(0,10);
      try {
        const r = await getTurnosPorFecha(fecha);
        all.push(...r.data);
      } catch {}
    }
    const m = {};
    all.forEach(t => {
      const idx = weekDates.findIndex(dd => dd.toISOString().slice(0,10) === t.fecha.slice(0,10));
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
    // Aplico 'free' de localStorage
    const store = JSON.parse(localStorage.getItem(FREE_KEY) || '{}');
    Object.entries(store).forEach(([uid, fechas]) => {
      fechas.forEach(f => {
        const idx = weekDates.findIndex(dd => dd.toISOString().slice(0,10) === f);
        if (idx >= 0) {
          m[uid] = m[uid] || {};
          m[uid][idx] = { free: true };
        }
      });
    });
    setCells(m);
  }, [weekDates]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 6) Función toggle 'Libre'
  const toggleLibre = (crewId, dayIdx) => {
    setCells(prev => {
      const next = { ...prev, [crewId]: { ...prev[crewId] } };
      next[crewId][dayIdx] = {
        ...(prev[crewId]?.[dayIdx] || {}),
        free: !prev[crewId]?.[dayIdx]?.free
      };
      // Actualizo localStorage
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

  // 7) Cambio manual de horas
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

  // 8) Cálculo horas trabajadas
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

  // 9) Guardar todos los cambios
  const saveAll = async () => {
    // Validación local: bloqueo días con beneficio
    for (const crew of crews) {
      const row = cells[crew.id] || {};
      for (let i = 0; i < 7; i++) {
        const c     = row[i];
        const fecha = weekDates[i].toISOString().slice(0,10);
        if (benefits[crew.id]?.[fecha]) {
          // no toco ese día
          continue;
        }
        // validación disponibilidad
        if (c && !c.free && c.inicio && c.fin) {
          const avail = disps[crew.id]?.[DAY_LABELS[i].toLowerCase()];
          if (!avail
            || parseTime(c.inicio) < parseTime(avail.inicio)
            || parseTime(c.fin)    > parseTime(avail.fin)
          ) {
            alert(`No puede guardar: ${crew.nombre} el ${DAY_LABELS[i]} de ${c.inicio} a ${c.fin} (disp ${avail?.inicio||'--'}–${avail?.fin||'--'})`);
            return;
          }
        }
      }
    }

    // Envío al servidor
    for (const crew of crews) {
      const row = cells[crew.id] || {};
      for (let i = 0; i < 7; i++) {
        const c     = row[i];
        const fecha = weekDates[i].toISOString().slice(0,10);

        // salto días con beneficio
        if (benefits[crew.id]?.[fecha]) continue;

        const payload = {
          fecha,
          hora_inicio: c?.inicio,
          hora_fin:    c?.fin,
          creado_por:  19,
          observaciones:''
        };

        // eliminar turno si borró horas
        if ((!c?.inicio || !c?.fin) && c?.id) {
          await eliminarTurno(c.id);
          continue;
        }

        // eliminar si marcó libre
        if (c?.free) {
          if (c.id) await eliminarTurno(c.id);
          continue;
        }

        // actualizar o crear
        if (c?.inicio && c?.fin) {
          if (c.id) await updateTurno(c.id, payload);
          else      await crearTurno({ usuario_id: crew.id, ...payload });
        }
      }
    }

    setEditing(false);
    await loadData();
    alert('Turnos procesados.');
  };

  // 10) Resumen diario
  const summary = weekDates.map((_, i) => {
    let total = 0, open = 0, close = 0;
    crews.forEach(c => {
      const t = cells[c.id]?.[i];
      if (t && !t.free && t.inicio && t.fin) {
        total++;
        if (t.fin === '23:30') close++;
        const sm = parseTime(t.inicio);
        if (sm >= parseTime('08:00') && sm <= parseTime('10:00')) open++;
      }
    });
    return { total, open, close };
  });

  // 11) Envío de correo
  const handleSendEmail = async () => {
    if (!window.confirm('¿Enviar la foto de esta planilla por correo?')) return;
    try {
      const tableEl = document.querySelector('.planilla-table');
      const canvas  = await html2canvas(tableEl);
      const img     = canvas.toDataURL('image/png');
      const destinatarios = crews.map(u => u.correo);
      await enviarCalendario({
        destinatarios,
        asunto: `Planilla Turnos ${baseDate}`,
        html: `<h2>Planilla de Turnos - Semana del ${baseDate}</h2><img src="${img}" style="max-width:100%;" />`
      });
      alert('Correos enviados correctamente.');
    } catch {
      alert('Error al enviar correos.');
    }
  };

  // 12) Limpiar tabla
  const handleClearTable = async () => {
    if (!window.confirm('¿Borrar todos los turnos y libres asignados?')) return;
    await eliminarTodosTurnos();
    localStorage.removeItem(FREE_KEY);
    setEditing(false);
    await loadData();
    alert('Tabla limpiada.');
  };

  // 13) Toggle edición
  const handleToggleEdit = () => {
    if (editing) {
      loadData();
      setEditing(false);
    } else {
      setEditing(true);
    }
  };

  return (
    <div className="planilla-container">
      <h2>Calendario Manual de Turnos</h2>

      <div className="planilla-controls">
        <div>
          <Link to="/usuarios"><button style={{marginRight:'1rem'}}>Ir a Crews</button></Link>
          <label>
            Semana:
            <input
              type="date"
              value={baseDate}
              onChange={e => setBaseDate(e.target.value)}
              style={{margin:'0 1rem'}}
            />
          </label>
          <button className="btn-edit" onClick={handleToggleEdit}>
            {editing ? 'Cancelar' : 'Editar'}
          </button>
          {editing && <button className="btn-save" onClick={saveAll} style={{marginLeft:'1rem'}}>Guardar Cambios</button>}
        </div>
        <div>
          <button onClick={handleClearTable} style={{marginRight:'1rem',background:'#c00',color:'#fff'}}>Limpiar tabla</button>
          <button className="btn-email" onClick={handleSendEmail}>Enviar por correo</button>
        </div>
      </div>

      <table className="planilla-table">
        <thead>
          <tr>
            <th>Crew / Día</th>
            {weekDates.map((d, i) => (
              <th key={i}>{DAY_LABELS[i]}<br/>{d.toLocaleDateString()}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {crews.map(c => (
            <tr key={c.id}>
              <td className="first-col">{c.nombre} ({horasTrabajadas(c.id)}/{c.horas_contrato})</td>
              {weekDates.map((d, i) => {
                const fecha = d.toISOString().slice(0,10);
                // 👉 Beneficio: muestra tipo y color adecuado
                const tipo = benefits[c.id]?.[fecha];
                if (tipo) {
                  return <td key={i} className={`benefit-${tipo}`}>{tipo}</td>;
                }
                // Si no hay beneficio, lógica normal
                const t     = cells[c.id]?.[i];
                const avail = disps[c.id]?.[DAY_LABELS[i].toLowerCase()];
                if (editing) {
                  if (t?.free) {
                    return (
                      <td key={i} className="free-cell">
                        <button className="btn-free edit-center" onClick={() => toggleLibre(c.id, i)}>
                          Libre
                        </button>
                      </td>
                    );
                  }
                  if (avail) {
                    return (
                      <td key={i}>
                        <input
                          type="time"
                          min={avail.inicio}
                          max={avail.fin}
                          value={t?.inicio || ''}
                          onChange={e => handleCellChange(c.id, i, 'inicio', e.target.value)}
                        />{' '}
                        –{' '}
                        <input
                          type="time"
                          min={avail.inicio}
                          max={avail.fin}
                          value={t?.fin || ''}
                          onChange={e => handleCellChange(c.id, i, 'fin', e.target.value)}
                        />
                        <button className="btn-block" onClick={() => toggleLibre(c.id, i)}>
                          ⛔
                        </button>
                      </td>
                    );
                  }
                  return (
                    <td key={i}>
                      <span className="not-available">No disponible</span>
                    </td>
                  );
                } else {
                  if (t?.free) {
                    return (
                      <td key={i} className="free-cell">
                        <span className="free-label">Libre</span>
                      </td>
                    );
                  }
                  if (t?.inicio && t?.fin) {
                    return (
                      <td key={i} className="assigned-cell">
                        {t.inicio}–{t.fin}
                      </td>
                    );
                  }
                  if (avail) {
                    return (
                      <td key={i} className="disp-range">
                        Disp {avail.inicio}–{avail.fin}
                      </td>
                    );
                  }
                  return (
                    <td key={i}>
                      <span className="not-available">No disponible</span>
                    </td>
                  );
                }
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Resumen</td>
            {summary.map(({ total, open, close }, i) => (
              <td key={i}>{total} (A:{open} C:{close})</td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}