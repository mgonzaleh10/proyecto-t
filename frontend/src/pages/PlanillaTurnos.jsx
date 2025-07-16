import React, { useState, useEffect } from 'react'
import { crearTurno } from '../api/turnos'
import { getUsuarios } from '../api/usuarios'

const DAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

/**
 * Dado un YYYY‑MM‑DD cualquiera, devuelve un array de 7 Date
 * comenzando por el lunes de esa misma semana.
 */
function getWeekDates(base) {
  const date = new Date(base)
  const day = date.getDay()           // 0=Domingo…6=Sábado
  // cálculo: para llegar al lunes restamos (day+6)%7
  const monday = new Date(date)
  monday.setDate(date.getDate() - ((day + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export default function PlanillaTurnos() {
  const [baseDate, setBaseDate] = useState(
    new Date().toISOString().slice(0, 10)
  )
  const [weekDates, setWeekDates] = useState(() =>
    getWeekDates(baseDate)
  )
  const [inputs, setInputs] = useState({}) // { 0: { usuario_id, inicio, fin }, … }
  const [crews, setCrews] = useState([])

  // cuando cambie la fecha de referencia, recalculamos la semana
  useEffect(() => {
    setWeekDates(getWeekDates(baseDate))
    setInputs({}) // limpiar inputs al cambiar semana
  }, [baseDate])

  // cargamos el listado de usuarios (crews)
  useEffect(() => {
    getUsuarios()
      .then(res => setCrews(res.data))
      .catch(err => console.error(err))
  }, [])

  const handleChange = (idx, field, value) => {
    setInputs(prev => ({
      ...prev,
      [idx]: {
        ...prev[idx],
        [field]: value
      }
    }))
  }

  const handleSubmit = async () => {
    for (let i = 0; i < 7; i++) {
      const data = inputs[i]
      if (!data) continue
      const { usuario_id, inicio, fin } = data
      if (!usuario_id || !inicio || !fin) continue

      await crearTurno({
        usuario_id: Number(usuario_id),
        fecha: weekDates[i].toISOString().slice(0, 10),
        hora_inicio: inicio,
        hora_fin: fin,
        creado_por: 19,
        observaciones: ''
      })
    }
    alert('Turnos creados correctamente.')
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Planilla de Turnos</h2>

      <label>
        Semana (elige cualquier día de la semana):
        <input
          type="date"
          value={baseDate}
          onChange={e => setBaseDate(e.target.value)}
          style={{ marginLeft: '0.5rem' }}
        />
      </label>

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginTop: '1rem'
        }}
      >
        <thead>
          <tr>
            <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Día</th>
            <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Fecha</th>
            <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Crew</th>
            <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Hora Inicio</th>
            <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Hora Fin</th>
          </tr>
        </thead>
        <tbody>
          {weekDates.map((d, i) => (
            <tr key={i}>
              <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>
                {DAY_LABELS[i]}
              </td>
              <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>
                {d.toLocaleDateString()}
              </td>
              <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>
                <select
                  value={inputs[i]?.usuario_id || ''}
                  onChange={e =>
                    handleChange(i, 'usuario_id', e.target.value)
                  }
                >
                  <option value="">Seleccionar...</option>
                  {crews.map(u => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </select>
              </td>
              <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>
                <input
                  type="time"
                  value={inputs[i]?.inicio || ''}
                  onChange={e => handleChange(i, 'inicio', e.target.value)}
                />
              </td>
              <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>
                <input
                  type="time"
                  value={inputs[i]?.fin || ''}
                  onChange={e => handleChange(i, 'fin', e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <button
        onClick={handleSubmit}
        style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}
      >
        Crear Turnos
      </button>
    </div>
  )
}