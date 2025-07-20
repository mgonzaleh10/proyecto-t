import React, { useState, useEffect } from 'react';
import {
  crearTurno,
  updateTurno,
  getTurnosPorFecha
} from '../api/turnos';
import { getUsuarios } from '../api/usuarios';
import { getDisponibilidades } from '../api/disponibilidades';

const DAY_LABELS = [
  'Lunes', 'Martes', 'Miércoles', 'Jueves',
  'Viernes', 'Sábado', 'Domingo'
];
const DAY_KEYS = [
  'lunes','martes','miércoles','jueves',
  'viernes','sábado','domingo'
];

// parsea "HH:MM" a minutos
function parseTime(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
// calcula horas netas (resta 1h de colación)
function calcularHoras({ inicio, fin }) {
  const mins = parseTime(fin) - parseTime(inicio);
  return Math.max(0, mins / 60 - 1);
}

// parsea YYYY‑MM‑DD a Date local
function parseLocalDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// devuelve array de 7 fechas lunes→domingo
function getWeekDates(base) {
  const date = typeof base === 'string'
    ? parseLocalDate(base)
    : new Date(base);
  const day = date.getDay();         // 0=Dom…6=Sáb
  const diffToMon = (day + 6) % 7;   // Domingo→6, Lunes→0…
  const monday = new Date(date);
  monday.setDate(date.getDate() - diffToMon);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function ManualCalendar() {
  const [baseDate, setBaseDate]   = useState(new Date().toISOString().slice(0,10));
  const [weekDates, setWeekDates] = useState(getWeekDates(baseDate));
  const [crews, setCrews]         = useState([]);
  const [availRaw, setAvailRaw]   = useState([]);
  const [availMap, setAvailMap]   = useState({});
  const [existing, setExisting]   = useState([]);
  const [cells, setCells]         = useState({});
  const [editing, setEditing]     = useState(false);

  // recalc semana y limpiar shifts
  useEffect(() => {
    setWeekDates(getWeekDates(baseDate));
    setExisting([]);
    setCells({});
  }, [baseDate]);

  // cargar crews
  useEffect(() => {
    getUsuarios().then(r => setCrews(r.data)).catch(console.error);
  }, []);

  // cargar disponibilidades
  useEffect(() => {
    getDisponibilidades().then(r => setAvailRaw(r.data)).catch(console.error);
  }, []);

  // montar mapa de disponibilidades
  useEffect(() => {
    const m = {};
    availRaw.forEach(d => {
      const crew = d.usuario_id;
      const dayIdx = DAY_KEYS.indexOf(d.dia_semana);
      if (dayIdx < 0) return;
      m[crew] = m[crew] || {};
      m[crew][dayIdx] = {
        inicio: d.hora_inicio.slice(0,5),
        fin:    d.hora_fin.slice(0,5)
      };
    });
    setAvailMap(m);
  }, [availRaw]);

  // cargar turnos existentes y montar celdas
  useEffect(() => {
    async function load() {
      const all = [];
      for (let d of weekDates) {
        const fecha = d.toISOString().slice(0,10);
        try {
          const r = await getTurnosPorFecha(fecha);
          all.push(...r.data);
        } catch {}
      }
      setExisting(all);
      const m = {};
      all.forEach(t => {
        const idx = weekDates.findIndex(d=>
          d.toISOString().slice(0,10) === t.fecha.slice(0,10)
        );
        if (idx < 0) return;
        m[t.usuario_id] = m[t.usuario_id] || {};
        m[t.usuario_id][idx] = {
          id:     t.id,
          inicio: t.hora_inicio.slice(0,5),
          fin:    t.hora_fin.slice(0,5)
        };
      });
      setCells(m);
    }
    load();
  }, [weekDates]);

  const handleCellChange = (crewId, dayIdx, field, val) => {
    setCells(prev => ({
      ...prev,
      [crewId]: {
        ...prev[crewId],
        [dayIdx]: {
          ...prev[crewId]?.[dayIdx],
          [field]: val
        }
      }
    }));
  };

  const saveAll = async () => {
    for (let crew of crews) {
      const row = cells[crew.id] || {};
      for (let i = 0; i < 7; i++) {
        const c = row[i];
        if (!c || !c.inicio || !c.fin) continue;
        const payload = {
          fecha:       weekDates[i].toISOString().slice(0,10),
          hora_inicio: c.inicio,
          hora_fin:    c.fin,
          creado_por:  19,
          observaciones:''
        };
        if (c.id) {
          await updateTurno(c.id, payload);
        } else {
          await crearTurno({ ...payload, usuario_id: crew.id });
        }
      }
    }
    setEditing(false);
    setExisting([]); // recarga
  };

  return (
    <div style={{ padding:'2rem' }}>
      <h2>Calendario Manual de Turnos</h2>

      <div style={{ marginBottom:'1rem' }}>
        <label>
          Semana:
          <input
            type="date"
            value={baseDate}
            onChange={e=>setBaseDate(e.target.value)}
            style={{ marginLeft:8 }}
          />
        </label>
        &nbsp;&nbsp;
        <button onClick={()=>setEditing(!editing)}>
          {editing ? 'Cancelar' : 'Editar'}
        </button>
        {editing && (
          <button onClick={saveAll} style={{ marginLeft:8 }}>
            Guardar Cambios
          </button>
        )}
      </div>

      <table style={table}>
        <thead>
          <tr>
            <th style={th}>Crew / Día</th>
            {weekDates.map((d,i)=>(
              <th key={i} style={th}>
                {DAY_LABELS[i]}<br/>{d.toLocaleDateString()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {crews.map(crew => {
            // calculo horas trabajadas esta semana
            const shifts = cells[crew.id] || {};
            const worked = Object.values(shifts)
              .filter(s => s.inicio && s.fin)
              .reduce((sum,s)=> sum + calcularHoras(s), 0);
            return (
              <tr key={crew.id}>
                <td style={tdLabel}>
                  {crew.nombre} ({worked.toFixed(1)}/{crew.horas_contrato})
                </td>
                {weekDates.map((_,i)=> {
                  const shift = cells[crew.id]?.[i];
                  const avail = availMap[crew.id]?.[i];
                  if (!editing) {
                    if (shift) {
                      return (
                        <td key={i} style={td}>
                          {`${shift.inicio}–${shift.fin}`}
                        </td>
                      );
                    } else if (avail) {
                      return (
                        <td key={i} style={td}>
                        {avail.inicio}–{avail.fin}
                        </td>
                      );
                    } else {
                      return (
                        <td key={i} style={{...td, color:'red'}}>
                          No disponible
                        </td>
                      );
                    }
                  }
                  // edición
                  if (!avail) {
                    return (
                      <td key={i} style={{...td, color:'red'}}>
                        No disponible
                      </td>
                    );
                  }
                  return (
                    <td key={i} style={td}>
                      <input
                        type="time"
                        value={shift?.inicio||''}
                        min={avail.inicio}
                        max={avail.fin}
                        onChange={e=>
                          handleCellChange(crew.id,i,'inicio',e.target.value)
                        }
                        style={{ width:'45%' }}
                      />–
                      <input
                        type="time"
                        value={shift?.fin||''}
                        min={avail.inicio}
                        max={avail.fin}
                        onChange={e=>
                          handleCellChange(crew.id,i,'fin',e.target.value)
                        }
                        style={{ width:'45%' }}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const table   = { width:'100%', borderCollapse:'collapse', marginTop:16 };
const th      = { border:'1px solid #ccc', padding:8, background:'#f5f5f5' };
const td      = { border:'1px solid #ccc', padding:8, textAlign:'center' };
const tdLabel = { ...td, fontWeight:'bold', background:'#fafafa' };