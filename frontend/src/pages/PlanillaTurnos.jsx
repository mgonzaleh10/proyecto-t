import React, { useState, useEffect } from 'react'; // Importo React y hooks
import { crearTurno, getTurnosPorFecha } from '../api/turnos'; // Importo API de turnos
import { getUsuarios } from '../api/usuarios'; // Importo API de usuarios

// Etiquetas de días para mostrar en UI
const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

// Convierto string "YYYY-MM-DD" a objeto Date local
function parseLocalDate(ymd) {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(year, month - 1, day);
}

// Calculo arreglo de fechas de lunes a domingo basado en baseDate
function getWeekDates(base) {
  const date = typeof base === 'string'
    ? parseLocalDate(base)
    : new Date(base);
  const day = date.getDay(); // 0=Domingo…6=Sábado
  const diffToMonday = (day + 6) % 7; // Ajusto para obtener lunes
  const monday = new Date(date);
  monday.setDate(date.getDate() - diffToMonday);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function PlanillaTurnos() {
  // Defino baseDate con fecha de hoy en 'YYYY-MM-DD'
  const [baseDate,  setBaseDate]  = useState(new Date().toISOString().slice(0,10));
  // Calculo fechas de la semana correspondiente a baseDate
  const [weekDates, setWeekDates] = useState(getWeekDates(baseDate));
  // Almaceno inputs temporales { díaIdx: { inicio, fin } }
  const [inputs,    setInputs]    = useState({});
  // Almaceno lista de crews (usuarios)
  const [crews,     setCrews]     = useState([]);
  // Guardo el crew seleccionado (usuario_id)
  const [crewSel,   setCrewSel]   = useState('');
  // Almaceno turnos ya existentes cargados del servidor
  const [existing,  setExisting]  = useState([]);

  // Cuando baseDate cambie, recalculo weekDates y limpio inputs y existing
  useEffect(() => {
    setWeekDates(getWeekDates(baseDate));
    setInputs({});
    setExisting([]);
  }, [baseDate]);

  // Al montar, obtengo lista de usuarios (crews)
  useEffect(() => {
    getUsuarios()
      .then(res => setCrews(res.data))
      .catch(console.error);
  }, []);

  // Cuando cambien weekDates, cargo turnos existentes de cada día
  useEffect(() => {
    async function fetchSemana() {
      const todos = [];
      for (let d of weekDates) {
        const fecha = d.toISOString().slice(0,10);
        try {
          const res = await getTurnosPorFecha(fecha);
          todos.push(...res.data);
        } catch {}
      }
      setExisting(todos);
    }
    fetchSemana();
  }, [weekDates]);

  // Manejo cambio en inputs de inicio/fin por índice de día
  const handleInput = (idx, field, value) => {
    setInputs(prev => ({
      ...prev,
      [idx]: { ...prev[idx], [field]: value }
    }));
  };

  // Al enviar, creo turnos para cada día con datos válidos
  const handleSubmit = async () => {
    if (!crewSel) {
      alert('Selecciona primero un crew.');
      return;
    }
    // Itero 7 días y creo turno si hay inicio y fin
    for (let i = 0; i < 7; i++) {
      const data = inputs[i];
      if (!data?.inicio || !data?.fin) continue;
      const turno = {
        usuario_id:   Number(crewSel),
        fecha:        weekDates[i].toISOString().slice(0,10),
        hora_inicio:  data.inicio,
        hora_fin:     data.fin,
        creado_por:   19,
        observaciones:''
      };
      try {
        await crearTurno(turno);
      } catch (err) {
        console.error('Error al crear turno:', err);
      }
    }
    // Recargo turnos existentes tras creación
    const recarga = [];
    for (let d of weekDates) {
      const fecha = d.toISOString().slice(0,10);
      try {
        const res = await getTurnosPorFecha(fecha);
        recarga.push(...res.data);
      } catch {}
    }
    setExisting(recarga);
    alert('Turnos creados correctamente.');
  };

  // Busco en existing un turno para crew e índice de día determinado
  const findExisting = (crewId, idx) => {
    const target = weekDates[idx].toISOString().slice(0,10);
    return existing.find(t => 
      t.usuario_id === crewId &&
      t.fecha.slice(0,10) === target
    );
  };

  return (
    <div style={{ padding:'2rem' }}> {/* Contenedor principal */}
      <h2>Planilla de Turnos</h2>

      {/* Selector de crew y fecha base */}
      <div style={{ marginBottom:'1rem' }}>
        <label>
          Crew:&nbsp;
          <select value={crewSel} onChange={e=>setCrewSel(e.target.value)}>
            <option value="">Seleccionar crew...</option>
            {crews.map(u=>(
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </select>
        </label>
        &nbsp;&nbsp;
        <label>
          Semana:&nbsp;
          <input
            type="date"
            value={baseDate}
            onChange={e=>setBaseDate(e.target.value)}
          />
        </label>
      </div>

      {/* Tabla para ingresar horas de cada día */}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={th}>Día</th>
            <th style={th}>Fecha</th>
            <th style={th}>Hora Inicio</th>
            <th style={th}>Hora Fin</th>
          </tr>
        </thead>
        <tbody>
          {weekDates.map((d,i)=>(
            <tr key={i}>
              <td style={tdLabel}>{DAY_LABELS[i]}</td>
              <td style={td}>{d.toLocaleDateString()}</td>
              <td style={td}>
                <input
                  type="time"
                  value={inputs[i]?.inicio||''}
                  onChange={e=>handleInput(i,'inicio',e.target.value)}
                />
              </td>
              <td style={td}>
                <input
                  type="time"
                  value={inputs[i]?.fin||''}
                  onChange={e=>handleInput(i,'fin',e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Botón para crear turnos */}
      <button onClick={handleSubmit} style={{ marginTop:'1rem',padding:'0.5rem 1rem' }}>
        Crear Turnos
      </button>

      {/* Resumen semanal persistente */}
      <h3 style={{ marginTop:'2rem' }}>Resumen semanal (persistente)</h3>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={th}>Crew \ Día</th>
            {weekDates.map((d,i)=>(
              <th key={i} style={th}>
                {DAY_LABELS[i]}<br/>{d.toLocaleDateString()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {crews.map(c=>(
            <tr key={c.id}>
              <td style={tdLabel}>{c.nombre}</td>
              {weekDates.map((_,i)=>{
                const t = findExisting(c.id,i);
                return (
                  <td key={i} style={td}>
                    {t
                      ? `${t.hora_inicio}–${t.hora_fin}`
                      : 'Libre'}
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

// Estilos en línea para tablas
const tableStyle = { width:'100%', borderCollapse:'collapse', marginTop:'1rem' };
const th         = { border:'1px solid #ccc', padding:'0.5rem', background:'#f7f7f7' };
const td         = { border:'1px solid #ccc', padding:'0.5rem', textAlign:'center' };
const tdLabel    = { ...td, fontWeight:'bold', textAlign:'left' };