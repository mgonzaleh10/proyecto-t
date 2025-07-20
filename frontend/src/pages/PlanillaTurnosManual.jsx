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
// para mapear índice de JS (0=domingo…6=sábado) a nombres usados en disponibilidades:
const DIAS = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

function parseLocalDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getWeekDates(base) {
  const date = typeof base === 'string'
    ? parseLocalDate(base)
    : new Date(base);
  const day = date.getDay();            // 0=Dom…6=Sáb
  const diffToMon = (day + 6) % 7;      // dom→6, lun→0…
  const monday = new Date(date);
  monday.setDate(date.getDate() - diffToMon);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function PlanillaTurnosManual() {
  const [baseDate, setBaseDate] = useState(
    new Date().toISOString().slice(0,10)
  );
  const [weekDates, setWeekDates] = useState(getWeekDates(baseDate));
  const [crews, setCrews]       = useState([]);
  const [existing, setExisting] = useState([]);
  const [cells, setCells]       = useState({});   // { crewId: { dayIdx: { id, inicio, fin } } }
  const [dispMap, setDispMap]   = useState({});   // { crewId: { dia_semana: { inicio, fin } } }
  const [editing, setEditing]   = useState(false);

  // 1) cuando cambie baseDate, recalcular semana y resetear
  useEffect(() => {
    const w = getWeekDates(baseDate);
    setWeekDates(w);
    setExisting([]);
    setCells({});
  }, [baseDate]);

  // 2) cargar crews
  useEffect(() => {
    getUsuarios()
      .then(r => setCrews(r.data))
      .catch(console.error);
  }, []);

  // 3) cargar disponibilidades
  useEffect(() => {
    async function loadDisp() {
      try {
        const r = await getDisponibilidades();
        const map = {};
        r.data.forEach(d => {
          map[d.usuario_id] ||= {};
          map[d.usuario_id][d.dia_semana] = {
            inicio: d.hora_inicio.slice(0,5),
            fin:    d.hora_fin.slice(0,5)
          };
        });
        setDispMap(map);
      } catch (e) {
        console.error(e);
      }
    }
    loadDisp();
  }, []);

  // 4) cargar turnos existentes de la semana
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
      // inicializar celdas
      const m = {};
      all.forEach(t => {
        const idx = weekDates.findIndex(d=>
          d.toISOString().slice(0,10) === t.fecha.slice(0,10)
        );
        if (idx >= 0) {
          m[t.usuario_id] ||= {};
          m[t.usuario_id][idx] = {
            id: t.id,
            inicio: t.hora_inicio.slice(0,5),
            fin:    t.hora_fin.slice(0,5)
          };
        }
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
        // si no tenía disponibilidad, salto
        const diaNombre = DIAS[ weekDates[i].getDay() ];
        if (!dispMap[crew.id]?.[diaNombre]) continue;

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
          await crearTurno({
            ...payload,
            usuario_id: crew.id
          });
        }
      }
    }
    setEditing(false);
    // recargo
    setExisting([]);
    const timer = setTimeout(() => {
      setExisting([]); 
      clearTimeout(timer);
    }, 0);
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
                {DAY_LABELS[i]}<br/>
                {d.toLocaleDateString()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {crews.map(c=>(
            <tr key={c.id}>
              <td style={tdLabel}>{c.nombre}</td>
              {weekDates.map((_,i)=> {
                const cell = cells[c.id]?.[i];
                const diaNombre = DIAS[ weekDates[i].getDay() ];
                const avail = dispMap[c.id]?.[diaNombre];
                return (
                  <td key={i} style={td}>
                    {editing
                      ? avail
                        ? <>
                            <input
                              type="time"
                              value={cell?.inicio||''}
                              onChange={e=>
                                handleCellChange(c.id,i,'inicio',e.target.value)
                              }
                              style={{ width: '45%' }}
                            /> – 
                            <input
                              type="time"
                              value={cell?.fin||''}
                              onChange={e=>
                                handleCellChange(c.id,i,'fin',e.target.value)
                              }
                              style={{ width: '45%' }}
                            />
                          </>
                        : <em style={{ color:'#c00' }}>No disponible</em>
                      : cell
                        ? `${cell.inicio}–${cell.fin}`
                        : avail
                          ? 'Libre'
                          : <em style={{ color:'#888' }}>No disponible</em>
                    }
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const table   = { width:'100%', borderCollapse:'collapse', marginTop:16 };
const th      = { border:'1px solid #ccc', padding:8, background:'#f5f5f5' };
const td      = { border:'1px solid #ccc', padding:8, textAlign:'center' };
const tdLabel = { ...td, fontWeight:'bold', background:'#fafafa' };