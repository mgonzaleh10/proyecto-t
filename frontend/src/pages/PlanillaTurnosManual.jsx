import React, { useState, useEffect } from 'react'
import {
  crearTurno,
  updateTurno,
  eliminarTurno,
  getTurnosPorFecha
} from '../api/turnos'
import { getUsuarios } from '../api/usuarios'
import { getDisponibilidades } from '../api/disponibilidades'

const DAY_LABELS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']

// parsea "HH:MM" a minutos totales
function parseTime(hm) {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}

function parseLocalDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function getWeekDates(base) {
  const date = typeof base === 'string'
    ? parseLocalDate(base)
    : new Date(base)
  const day = date.getDay()          // 0 = Domingo
  const diffToMon = (day + 6) % 7    // Domingo→6, Lunes→0…
  const monday = new Date(date)
  monday.setDate(date.getDate() - diffToMon)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export default function PlanillaTurnosManual() {
  const [baseDate,  setBaseDate]  = useState(new Date().toISOString().slice(0,10))
  const [weekDates, setWeekDates] = useState(getWeekDates(baseDate))
  const [crews,     setCrews]     = useState([])
  const [existing,  setExisting]  = useState([])
  const [cells,     setCells]     = useState({})
  const [editing,   setEditing]   = useState(false)
  const [disps,     setDisps]     = useState({})

  // 1) Recalcula la semana cuando cambie la fecha base
  useEffect(() => {
    setWeekDates(getWeekDates(baseDate))
    setExisting([])
    setCells({})
  }, [baseDate])

  // 2) Carga los crews
  useEffect(() => {
    getUsuarios().then(r => setCrews(r.data)).catch(console.error)
  }, [])

  // 3) Carga disponibilidades
  useEffect(() => {
    getDisponibilidades().then(r => {
      const m = {}
      r.data.forEach(d => {
        const dia = d.dia_semana.toLowerCase()
        m[d.usuario_id] = m[d.usuario_id] || {}
        m[d.usuario_id][dia] = {
          inicio: d.hora_inicio.slice(0,5),
          fin:    d.hora_fin.slice(0,5)
        }
      })
      setDisps(m)
    }).catch(console.error)
  }, [])

  // 4) Carga turnos existentes y popula cells
  useEffect(() => {
    async function load() {
      const all = []
      for (const d of weekDates) {
        const fecha = d.toISOString().slice(0,10)
        try {
          const r = await getTurnosPorFecha(fecha)
          all.push(...r.data)
        } catch {}
      }
      setExisting(all)
      const m = {}
      all.forEach(t => {
        const idx = weekDates.findIndex(d => d.toISOString().slice(0,10) === t.fecha.slice(0,10))
        if (idx >= 0) {
          m[t.usuario_id] = m[t.usuario_id] || {}
          m[t.usuario_id][idx] = {
            id: t.id,
            inicio: t.hora_inicio.slice(0,5),
            fin:    t.hora_fin.slice(0,5),
            free:   false
          }
        }
      })
      setCells(m)
    }
    load()
  }, [weekDates])

  // Maneja cambios en una celda
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
    }))
  }

  // Alterna “Libre” para un día
  const toggleLibre = (crewId, dayIdx) => {
    setCells(prev => ({
      ...prev,
      [crewId]: {
        ...prev[crewId],
        [dayIdx]: {
          ...(prev[crewId]?.[dayIdx] || {}),
          free: !prev[crewId]?.[dayIdx]?.free
        }
      }
    }))
  }

  // Calcula horas trabajadas esta semana para un crew
  const horasTrabajadas = crewId => {
    const row = cells[crewId] || {}
    let total = 0
    Object.values(row).forEach(c => {
      if (c && !c.free && c.inicio && c.fin) {
        const mins = parseTime(c.fin) - parseTime(c.inicio)
        total += Math.max(0, mins/60 - 1)  // menos 1h colación
      }
    })
    return +total.toFixed(1)
  }

  // Guarda todos los cambios
  const saveAll = async () => {
    for (const crew of crews) {
      const row = cells[crew.id] || {}
      for (let i = 0; i < 7; i++) {
        const c = row[i]
        if (!c) continue
        const payload = {
          fecha:       weekDates[i].toISOString().slice(0,10),
          hora_inicio: c.inicio,
          hora_fin:    c.fin,
          creado_por:  19,
          observaciones:''
        }
        if (c.free) {
          if (c.id) await eliminarTurno(c.id)
          continue
        }
        if (c.inicio && c.fin) {
          if (c.id) await updateTurno(c.id, payload)
          else    await crearTurno({ ...payload, usuario_id: crew.id })
        }
      }
    }
    setEditing(false)
    // Forzar recarga de la vista
    setExisting([])
  }

  return (
    <div style={{ padding:'2rem' }}>
      <h2>Calendario Manual de Turnos</h2>
      <div style={{ marginBottom:'1rem' }}>
        <label>
          Semana:
          <input
            type="date"
            value={baseDate}
            onChange={e => setBaseDate(e.target.value)}
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
            {weekDates.map((d,i) => (
              <th key={i} style={th}>
                {DAY_LABELS[i]}<br/>{d.toLocaleDateString()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {crews.map(c => (
            <tr key={c.id}>
              <td style={tdLabel}>
                {c.nombre} ({horasTrabajadas(c.id)}/{c.horas_contrato})
              </td>
              {weekDates.map((_,i) => {
                const cell    = cells[c.id]?.[i]
                const dayName = DAY_LABELS[i].toLowerCase()
                const avail   = disps[c.id]?.[dayName]
                return (
                  <td key={i} style={td}>
                    {editing ? (
                      avail ? (
                        <>
                          <input
                            type="time"
                            min={avail.inicio}
                            max={avail.fin}
                            value={cell?.inicio||''}
                            onChange={e=>handleCellChange(c.id,i,'inicio',e.target.value)}
                            style={{ width:'40%' }}
                          />
                          –
                          <input
                            type="time"
                            min={avail.inicio}
                            max={avail.fin}
                            value={cell?.fin||''}
                            onChange={e=>handleCellChange(c.id,i,'fin',e.target.value)}
                            style={{ width:'40%' }}
                          />
                          <button
                            onClick={()=>toggleLibre(c.id,i)}
                            style={{
                              marginLeft:4,
                              background: cell?.free ? '#0a0' : '#a00',
                              color:'white',
                              border:'none',
                              padding:'2px 6px'
                            }}
                          >
                            {cell?.free ? 'Libre' : '⛔'}
                          </button>
                        </>
                      ) : (
                        <span style={{ color:'crimson' }}>No disponible</span>
                      )
                    ) : (
                      cell?.free ? (
                        'Libre'
                      ) : cell?.inicio && cell?.fin ? (
                        `${cell.inicio}–${cell.fin}`
                      ) : avail ? (
                        `Disp ${avail.inicio}–${avail.fin}`
                      ) : (
                        <span style={{ color:'crimson' }}>No disponible</span>
                      )
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const table   = { width:'100%', borderCollapse:'collapse', marginTop:16 }
const th      = { border:'1px solid #ccc', padding:8, background:'#f5f5f5' }
const td      = { border:'1px solid #ccc', padding:8, textAlign:'center' }
const tdLabel = { ...td, fontWeight:'bold', background:'#fafafa' }