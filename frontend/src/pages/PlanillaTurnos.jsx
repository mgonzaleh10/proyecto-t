import React, { useState, useEffect } from 'react'
import { crearTurno } from '../api/turnos'
import { getUsuarios } from '../api/usuarios'

const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/**
 * Parsea "YYYY-MM-DD" a Date local.
 */
function parseLocalDate(ymd) {
  const [year, month, day] = ymd.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/**
 * Dado un Date o "YYYY-MM-DD", devuelve un array de 7 Date
 * comenzando siempre por el lunes de esa misma semana.
 */
function getWeekDates(base) {
  const date = typeof base === 'string'
    ? parseLocalDate(base)
    : new Date(base)
  const day = date.getDay()         // 0 = domingo ... 6 = sábado
  const diffToMonday = (day + 6) % 7
  const monday = new Date(date)
  monday.setDate(date.getDate() - diffToMonday)

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export default function PlanillaTurnos() {
  // fecha base seleccionada
  const [baseDate, setBaseDate] = useState(
    new Date().toISOString().slice(0, 10)
  )
  // array de 7 Date de lunes a domingo
  const [weekDates, setWeekDates] = useState(getWeekDates(baseDate))
  // solo hora inicio/fin por índice 0..6
  const [slots, setSlots] = useState({})
  // lista de crews
  const [crews, setCrews] = useState([])
  const [selectedCrew, setSelectedCrew] = useState('')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // cuando cambia baseDate, recalcular semana y limpiar slots
  useEffect(() => {
    setWeekDates(getWeekDates(baseDate))
    setSlots({})
    setError(null)
    setSuccess(null)
  }, [baseDate])

  // cargar crews
  useEffect(() => {
    getUsuarios()
      .then(res => setCrews(res.data))
      .catch(() => setCrews([]))
  }, [])

  // actualiza slots[index].inicio o slots[index].fin
  const handleSlotChange = (idx, field, value) => {
    setSlots(prev => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        [field]: value
      }
    }))
  }

  // envía todos los turnos
  const handleSubmit = async e => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!selectedCrew) {
      setError('Selecciona primero un crew.')
      return
    }
    try {
      let count = 0
      for (let i = 0; i < 7; i++) {
        const slot = slots[i]
        if (!slot?.inicio || !slot?.fin) continue
        const fecha = weekDates[i].toISOString().slice(0, 10)
        await crearTurno({
          usuario_id: Number(selectedCrew),
          fecha,
          hora_inicio: slot.inicio,
          hora_fin: slot.fin,
          creado_por: 19,
          observaciones: ''
        })
        count++
      }
      if (count) {
        setSuccess(`Se crearon ${count} turno(s) para el crew ${selectedCrew}.`)
      } else {
        setError('No definiste franjas de inicio/fin válidas.')
      }
    } catch (err) {
      console.error(err)
      setError('Error al crear turnos. Mira la consola.')
    }
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Planilla de Turnos Semanal</h2>

      <div style={{ margin: '1rem 0' }}>
        <label>
          Crew:
          <select
            value={selectedCrew}
            onChange={e => setSelectedCrew(e.target.value)}
            style={{ marginLeft: '0.5rem' }}
          >
            <option value="">-- Elige crew --</option>
            {crews.map(u => (
              <option key={u.id} value={u.id}>
                {u.nombre} (ID {u.id})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ margin: '1rem 0' }}>
        <label>
          Semana (elige cualquier día):
          <input
            type="date"
            value={baseDate}
            onChange={e => setBaseDate(e.target.value)}
            style={{ marginLeft: '0.5rem' }}
          />
        </label>
      </div>

      <form onSubmit={handleSubmit}>
        <table
          border="1"
          cellPadding="8"
          style={{ borderCollapse: 'collapse', width: '100%' }}
        >
          <thead>
            <tr>
              <th>Día</th>
              <th>Fecha</th>
              <th>Hora Inicio</th>
              <th>Hora Fin</th>
            </tr>
          </thead>
          <tbody>
            {weekDates.map((d, i) => (
              <tr key={i}>
                <td>{DAY_LABELS[i]}</td>
                <td>{d.toLocaleDateString()}</td>
                <td>
                  <input
                    type="time"
                    value={slots[i]?.inicio || ''}
                    onChange={e => handleSlotChange(i, 'inicio', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    value={slots[i]?.fin || ''}
                    onChange={e => handleSlotChange(i, 'fin', e.target.value)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <button type="submit" style={{ marginTop: '1rem' }}>
          Guardar Turnos
        </button>
      </form>

      {error && <p style={{ color: 'red', marginTop: '1rem' }}>{error}</p>}
      {success && <p style={{ color: 'green', marginTop: '1rem' }}>{success}</p>}
    </div>
  )
}