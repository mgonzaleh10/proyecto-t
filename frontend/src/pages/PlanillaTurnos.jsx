import React, { useState, useEffect } from 'react'
import { crearTurno } from '../api/turnos'
import { getUsuarios } from '../api/usuarios' // asume que tienes este endpoint

export default function PlanillaTurnos() {
  // Genera los 7 días a partir de hoy
  const [fechas, setFechas] = useState([])
  const [crews, setCrews] = useState([])
  const [selectedCrew, setSelectedCrew] = useState('')
  // slots: { '2025-07-07': { inicio: '08:00', fin: '18:00' }, ... }
  const [planilla, setPlanilla] = useState({})

  useEffect(() => {
    // 1) Inicializa la semana
    const hoy = new Date()
    const arr = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(hoy)
      d.setDate(hoy.getDate() + i)
      return d.toISOString().slice(0, 10)
    })
    setFechas(arr)

    // 2) Carga los crews para el selector
    getUsuarios().then(res => setCrews(res.data)).catch(console.error)
  }, [])

  const handleChange = (fecha, field, value) => {
    setPlanilla(prev => ({
      ...prev,
      [fecha]: {
        ...prev[fecha],
        [field]: value
      }
    }))
  }

  const handleGuardar = async () => {
    if (!selectedCrew) {
      alert('Selecciona primero un crew')
      return
    }
    for (const f of fechas) {
      const { inicio, fin } = planilla[f] || {}
      if (!inicio || !fin) continue
      await crearTurno({
        usuario_id: Number(selectedCrew),
        fecha: f,
        hora_inicio: inicio,
        hora_fin: fin,
        creado_por: 19,
        observaciones: ''
      })
    }
    alert('Turnos creados')
    setPlanilla({})
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Planilla Semanal de Turnos</h2>
      <div style={{ marginBottom: '1rem' }}>
        <label>
          Crew:
          <select
            value={selectedCrew}
            onChange={e => setSelectedCrew(e.target.value)}
            style={{ marginLeft: '0.5rem' }}
          >
            <option value="">-- Elige un crew --</option>
            {crews.map(u => (
              <option key={u.id} value={u.id}>
                {u.id} – {u.nombre || `Contrato ${u.horas_contrato}h`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hora inicio</th>
            <th>Hora fin</th>
          </tr>
        </thead>
        <tbody>
          {fechas.map(f => (
            <tr key={f}>
              <td>{new Date(f).toLocaleDateString()}</td>
              <td>
                <input
                  type="time"
                  value={planilla[f]?.inicio || ''}
                  onChange={e => handleChange(f, 'inicio', e.target.value)}
                />
              </td>
              <td>
                <input
                  type="time"
                  value={planilla[f]?.fin || ''}
                  onChange={e => handleChange(f, 'fin', e.target.value)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={handleGuardar} style={{ marginTop: '1rem' }}>
        Guardar planilla
      </button>
    </div>
  )
}