import React, { useState, useEffect, useCallback } from 'react'
import {
  crearTurno,
  updateTurno,
  eliminarTurno,
  getTurnosPorFecha,
  enviarCalendario
} from '../api/turnos'
import { getUsuarios } from '../api/usuarios'
import { getDisponibilidades } from '../api/disponibilidades'

import './PlanillaTurnosManual.css'

const DAY_LABELS = [
  'Lunes','Martes','Miércoles','Jueves',
  'Viernes','Sábado','Domingo'
]
const FREE_KEY = 'freeMap'

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
  const day = date.getDay()           // 0=Domingo … 6=Sábado
  const diffToMon = (day + 6) % 7     // Domingo→6, Lunes→0 …
  const monday = new Date(date)
  monday.setDate(date.getDate() - diffToMon)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export default function PlanillaTurnosManual() {
  const [baseDate,  setBaseDate]  = useState(
    new Date().toISOString().slice(0,10)
  )
  const [weekDates, setWeekDates] = useState(
    getWeekDates(baseDate)
  )
  const [crews,     setCrews]     = useState([])
  const [cells,     setCells]     = useState({})
  const [editing,   setEditing]   = useState(false)
  const [disps,     setDisps]     = useState({})

  // 1) Load or reload all turns & “free” flags
  const loadData = useCallback(async () => {
    const all = []
    for (const d of weekDates) {
      const f = d.toISOString().slice(0,10)
      try {
        const r = await getTurnosPorFecha(f)
        all.push(...r.data)
      } catch {}
    }
    const m = {}
    all.forEach(t => {
      const idx = weekDates.findIndex(d =>
        d.toISOString().slice(0,10) === t.fecha.slice(0,10)
      )
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
    // Reapply “free” from localStorage
    const store = JSON.parse(localStorage.getItem(FREE_KEY) || '{}')
    Object.entries(store).forEach(([uid, fechas]) => {
      const crewId = Number(uid)
      fechas.forEach(fStr => {
        const idx = weekDates.findIndex(d =>
          d.toISOString().slice(0,10) === fStr
        )
        if (idx >= 0) {
          m[crewId] = m[crewId] || {}
          m[crewId][idx] = { free: true }
        }
      })
    })
    setCells(m)
  }, [weekDates])

  // 2) Update weekDates when baseDate changes
  useEffect(() => {
    setWeekDates(getWeekDates(baseDate))
  }, [baseDate])

  // 3) Reload data every time weekDates updates
  useEffect(() => {
    loadData()
  }, [loadData])

  // 4) Load crews
  useEffect(() => {
    getUsuarios()
      .then(r => setCrews(r.data))
      .catch(console.error)
  }, [])

  // 5) Load disponibilidades
  useEffect(() => {
    getDisponibilidades()
      .then(r => {
        const m = {}
        r.data.forEach(d => {
          const day = d.dia_semana.toLowerCase()
          m[d.usuario_id] = m[d.usuario_id] || {}
          m[d.usuario_id][day] = {
            inicio: d.hora_inicio.slice(0,5),
            fin:    d.hora_fin.slice(0,5)
          }
        })
        setDisps(m)
      })
      .catch(console.error)
  }, [])

  // Toggle “Libre” and persist in localStorage
  const toggleLibre = (crewId, dayIdx) => {
    setCells(prev => {
      const next = {
        ...prev,
        [crewId]: {
          ...prev[crewId],
          [dayIdx]: {
            ...(prev[crewId]?.[dayIdx]||{}),
            free: !prev[crewId]?.[dayIdx]?.free
          }
        }
      }
      const f = weekDates[dayIdx].toISOString().slice(0,10)
      const store = JSON.parse(localStorage.getItem(FREE_KEY)||'{}')
      const setF = new Set(store[crewId]||[])
      if (next[crewId][dayIdx].free) setF.add(f)
      else setF.delete(f)
      store[crewId] = Array.from(setF)
      localStorage.setItem(FREE_KEY, JSON.stringify(store))
      return next
    })
  }

  // On editing a time, clear the free flag
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

  // Sum hours worked in week (subtract 1h for break)
  const horasTrabajadas = crewId => {
    const row = cells[crewId]||{}
    let total = 0
    Object.values(row).forEach(c => {
      if (c && !c.free && c.inicio && c.fin) {
        const mins = parseTime(c.fin) - parseTime(c.inicio)
        total += Math.max(0, mins/60 - 1)
      }
    })
    return +total.toFixed(1)
  }

  // Save all (create, update or delete turns)
  const saveAll = async () => {
    for (const crew of crews) {
      const row = cells[crew.id]||{}
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

  // Weekly summary: total / apertura / cierre
  const summary = weekDates.map((_, i) => {
    let total = 0, open = 0, close = 0
    crews.forEach(c => {
      const cc = cells[c.id]?.[i]
      if (cc && !cc.free && cc.inicio && cc.fin) {
        total++
        if (cc.fin === '23:30') close++
        const sm = parseTime(cc.inicio)
        if (sm >= parseTime('08:00') && sm <= parseTime('10:00')) {
          open++
        }
      }
    })
    return { total, open, close }
  })

  // ◀ Send by email, fallback to your own if none found
  const sendByEmail = async () => {
    try {
      let destinatarios = crews
        .map(c => c.correo || c.email)
        .filter(Boolean)

      // Si no hay ningún correo en los crews, probar con tu propio email:
      if (destinatarios.length === 0) {
        destinatarios = ['moisescaceresgonzalez@gmail.com']
      }

      const asunto = `Horario Semana de ${baseDate}`

      let html = '<h3>Calendario de Turnos</h3>'
      html += '<table border="1" cellpadding="5" cellspacing="0">'
      html += '<thead><tr><th>Crew / Día</th>'
      weekDates.forEach((d,i) => {
        html += `<th>${DAY_LABELS[i]}<br/>${d.toLocaleDateString()}</th>`
      })
      html += '</tr></thead><tbody>'

      crews.forEach(c => {
        html += `<tr><td>${c.nombre} (${horasTrabajadas(c.id)}/${c.horas_contrato})</td>`
        weekDates.forEach((_,i) => {
          const cc = cells[c.id]?.[i]
          const dn = DAY_LABELS[i].toLowerCase()
          const av = disps[c.id]?.[dn]
          let content = ''
          if (cc?.free) content = 'Libre'
          else if (cc?.inicio && cc?.fin) content = `${cc.inicio}-${cc.fin}`
          else if (av) content = `Disp ${av.inicio}-${av.fin}`
          else content = 'No disponible'
          html += `<td>${content}</td>`
        })
        html += '</tr>'
      })

      html += '</tbody></table>'

      await enviarCalendario({ destinatarios, asunto, html })
      alert('Correo enviado correctamente')
    } catch (err) {
      console.error('❌ Error al enviar correo:', err)
      alert('Error al enviar correo')
    }
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

        <button
          className="btn-edit"
          onClick={() => setEditing(!editing)}
        >
          {editing ? 'Cancelar' : 'Editar'}
        </button>

        <button
          className="btn-email"
          onClick={sendByEmail}
        >
          Enviar por correo
        </button>

        {editing && (
          <button
            className="btn-save"
            onClick={saveAll}
          >
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
                const cell = cells[c.id]?.[i]
                const dn   = DAY_LABELS[i].toLowerCase()
                const av   = disps[c.id]?.[dn]
                const isAss = cell && !cell.free && cell.inicio && cell.fin
                const isFree = cell?.free
                let cls = ''
                if (isAss) cls = 'assigned-cell'
                else if (isFree) cls = 'free-cell'
                return (
                  <td key={i} className={cls}>
                    {editing ? (
                      av ? (
                        isFree ? (
                          <div className="free-cell-edit">
                            <button
                              className="btn-free edit-center"
                              onClick={() => toggleLibre(c.id,i)}
                            >
                              Libre
                            </button>
                          </div>
                        ) : (
                          <>
                            <input
                              type="time"
                              min={av.inicio}
                              max={av.fin}
                              value={cell?.inicio||''}
                              onChange={e=>handleCellChange(c.id,i,'inicio',e.target.value)}
                            />
                            –
                            <input
                              type="time"
                              min={av.inicio}
                              max={av.fin}
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
                    ) : isFree ? (
                      <span className="free-label">Libre</span>
                    ) : isAss ? (
                      `${cell.inicio}–${cell.fin}`
                    ) : av ? (
                      <span className="disp-range">
                        Disp {av.inicio}–{av.fin}
                      </span>
                    ) : (
                      <span className="not-available">No disponible</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Resumen</td>
            {summary.map(({ total, open, close },i) => (
              <td key={i}>
                {total} (A:{open} C:{close})
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}