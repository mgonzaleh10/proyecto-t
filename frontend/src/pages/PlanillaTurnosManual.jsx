import React, { useState, useEffect, useCallback } from 'react'
import {
  crearTurno,
  updateTurno,
  eliminarTurno,
  getTurnosPorFecha
} from '../api/turnos'
import { getUsuarios } from '../api/usuarios'
import { getDisponibilidades } from '../api/disponibilidades'

import './PlanillaTurnosManual.css'

const DAY_LABELS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']
const FREE_KEY = 'freeMap'  // key en localStorage

function parseTime(hm) {
  const [h, m] = hm.split(':').map(Number)
  return h * 60 + m
}
function parseLocalDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d)
}
function getWeekDates(base) {
  const date = typeof base === 'string' ? parseLocalDate(base) : new Date(base)
  const day = date.getDay()
  const diffToMon = (day + 6) % 7
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
  const [cells,     setCells]     = useState({})
  const [editing,   setEditing]   = useState(false)
  const [disps,     setDisps]     = useState({})

  // Carga/recarga de datos
  const loadData = useCallback(async () => {
    // 1) Traer todos los turnos de la semana
    const all = []
    for (const d of weekDates) {
      const fecha = d.toISOString().slice(0,10)
      try {
        const r = await getTurnosPorFecha(fecha)
        all.push(...r.data)
      } catch {}
    }
    // 2) Mapear a cells
    const m = {}
    all.forEach(t => {
      const idx = weekDates.findIndex(d => d.toISOString().slice(0,10) === t.fecha.slice(0,10))
      if (idx >= 0) {
        m[t.usuario_id] = m[t.usuario_id] || {}
        m[t.usuario_id][idx] = {
          id:     t.id,
          inicio: t.hora_inicio.slice(0,5),
          fin:    t.hora_fin.slice(0,5),
          free:   false
        }
      }
    })
    // 3) Reaplicar “Libre” desde localStorage (por fecha)
    const store = JSON.parse(localStorage.getItem(FREE_KEY) || '{}')
    Object.entries(store).forEach(([uid, fechas]) => {
      const crewId = Number(uid)
      fechas.forEach(fechaStr => {
        const idx = weekDates.findIndex(d => d.toISOString().slice(0,10) === fechaStr)
        if (idx >= 0) {
          m[crewId] = m[crewId] || {}
          m[crewId][idx] = { free: true }
        }
      })
    })

    setCells(m)
  }, [weekDates])

  // Cuando cambia la semana de baseDate
  useEffect(() => {
    setWeekDates(getWeekDates(baseDate))
  }, [baseDate])

  // Recarga al cambiar weekDates
  useEffect(() => {
    loadData()
  }, [loadData])

  // Carga de crews
  useEffect(() => {
    getUsuarios().then(r => setCrews(r.data)).catch(console.error)
  }, [])

  // Carga disponibilidades
  useEffect(() => {
    getDisponibilidades()
      .then(r => {
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
      })
      .catch(console.error)
  }, [])

  // Alternar Libre y guardar en localStorage
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
      }
      const fecha = weekDates[dayIdx].toISOString().slice(0,10)
      const store = JSON.parse(localStorage.getItem(FREE_KEY) || '{}')
      const setFechas = new Set(store[crewId] || [])
      if (next[crewId][dayIdx].free) setFechas.add(fecha)
      else setFechas.delete(fecha)
      store[crewId] = Array.from(setFechas)
      localStorage.setItem(FREE_KEY, JSON.stringify(store))
      return next
    })
  }

  // Al editar hora, quitar free
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
    }))
  }

  // Calcular horas trabajadas
  const horasTrabajadas = crewId => {
    const row = cells[crewId] || {}
    let total = 0
    Object.values(row).forEach(c => {
      if (c && !c.free && c.inicio && c.fin) {
        const mins = parseTime(c.fin) - parseTime(c.inicio)
        total += Math.max(0, mins/60 - 1)
      }
    })
    return +total.toFixed(1)
  }

  // Guardar todo y recargar
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
    await loadData()
  }

  return (
    <div className="planilla-container">
      <h2>Calendario Manual de Turnos</h2>

      <div className="planilla-controls">
        <label>
          Semana:
          <input
            type="date"
            value={baseDate}
            onChange={e => setBaseDate(e.target.value)}
          />
        </label>
        <button className="btn-edit" onClick={() => setEditing(!editing)}>
          {editing ? 'Cancelar' : 'Editar'}
        </button>
        {editing && (
          <button className="btn-save" onClick={saveAll}>
            Guardar Cambios
          </button>
        )}
      </div>

      <table className="planilla-table">
        <thead>
          <tr>
            <th>Crew / Día</th>
            {weekDates.map((d,i) => (
              <th key={i}>
                {DAY_LABELS[i]}<br/>{d.toLocaleDateString()}
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
              {weekDates.map((_,i) => {
                const cell    = cells[c.id]?.[i]
                const dayName = DAY_LABELS[i].toLowerCase()
                const avail   = disps[c.id]?.[dayName]
                return (
                  <td key={i}>
                    {editing ? (
                      avail ? (
                        cell?.free ? (
                          //  → CELDA LIBRE: botón centrado y sin inputs
                          <div className="free-cell-edit">
                            <button
                              className="btn-free edit-center"
                              onClick={() => toggleLibre(c.id,i)}
                            >
                              Libre
                            </button>
                          </div>
                        ) : (
                          //  → CELDA NORMAL: inputs + “⛔”
                          <>
                            <input
                              type="time"
                              min={avail.inicio}
                              max={avail.fin}
                              value={cell?.inicio||''}
                              onChange={e=>handleCellChange(c.id,i,'inicio',e.target.value)}
                            />
                            –
                            <input
                              type="time"
                              min={avail.inicio}
                              max={avail.fin}
                              value={cell?.fin||''}
                              onChange={e=>handleCellChange(c.id,i,'fin',e.target.value)}
                            />
                            <button
                              className="btn-block"
                              onClick={() => toggleLibre(c.id,i)}
                            >
                              ⛔
                            </button>
                          </>
                        )
                      ) : (
                        <span className="not-available">No disponible</span>
                      )
                    ) : (
                      cell?.free ? (
                        <span className="free-label">Libre</span>
                      ) : cell?.inicio && cell?.fin ? (
                        `${cell.inicio}–${cell.fin}`
                      ) : avail ? (
                        <span className="disp-range">
                          Disp {avail.inicio}–{avail.fin}
                        </span>
                      ) : (
                        <span className="not-available">No disponible</span>
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