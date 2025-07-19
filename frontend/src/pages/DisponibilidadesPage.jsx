import React, { useState, useEffect } from 'react';
import { getUsuarios } from '../api/usuarios';
import {
  getDisponibilidades,
  crearDisponibilidad,
  eliminarDisponibilidad,
  eliminarTodasDisponibilidades
} from '../api/disponibilidades';

const DAY_LABELS = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];

export default function DisponibilidadesPage() {
  const [crews, setCrews] = useState([]);
  const [selectedCrew, setSelectedCrew] = useState('');
  // inputs: { día: { inicio: 'HH:MM', fin: 'HH:MM' } }
  const [inputs, setInputs] = useState({});
  // guardamos lo que trae el servidor
  const [saved, setSaved] = useState([]);

  // cargar crews y disponibilidades al montar
  useEffect(() => {
    getUsuarios().then(r => setCrews(r.data)).catch(console.error);
    getDisponibilidades().then(r => setSaved(r.data)).catch(console.error);
  }, []);

  // cuando cambie de crew, precargamos sus disponibilidades
  useEffect(() => {
    if (!selectedCrew) {
      setInputs({});
      return;
    }
    const byCrew = saved.filter(d => d.usuario_id === Number(selectedCrew));
    const map = {};
    byCrew.forEach(d => {
      map[d.dia_semana] = {
        inicio: d.hora_inicio.slice(0,5),
        fin:    d.hora_fin.slice(0,5),
        id:     d.id
      };
    });
    setInputs(map);
  }, [selectedCrew, saved]);

  const handleChange = (day, field, val) => {
    setInputs(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: val
      }
    }));
  };

  const handleSave = async () => {
    if (!selectedCrew) {
      alert('Selecciona primero un crew.');
      return;
    }
    // opcional: borrar todas las viejas de este crew
    // await eliminarTodasDisponibilidadesPorUsuario(selectedCrew);

    // para simplicidad, mandamos solo las que definiste
    const payload = Object.entries(inputs)
      .filter(([_, v]) => v.inicio && v.fin)
      .map(([dia_semana, v]) => ({
        usuario_id: Number(selectedCrew),
        dia_semana,
        hora_inicio: v.inicio,
        hora_fin:    v.fin
      }));

    if (payload.length === 0) {
      alert('No hay disponibilidades para guardar.');
      return;
    }

    try {
      await crearDisponibilidad(payload);
      alert('Disponibilidades guardadas.');
      // recarga la lista
      const r = await getDisponibilidades();
      setSaved(r.data);
    } catch (e) {
      console.error(e);
      alert('Error al guardar.');
    }
  };

  const handleClear = async () => {
    if (!window.confirm('¿Eliminar TODAS las disponibilidades?')) return;
    await eliminarTodasDisponibilidades();
    setSaved([]);
    setInputs({});
    alert('Eliminadas todas.');
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Configuración de Disponibilidades</h2>

      <div style={{ marginBottom: '1rem' }}>
        <label>
          Elige un crew:
          <select
            value={selectedCrew}
            onChange={e => setSelectedCrew(e.target.value)}
            style={{ marginLeft: '0.5rem' }}
          >
            <option value="">-- Seleccionar --</option>
            {crews.map(u => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selectedCrew && (
        <>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginBottom: '1rem'
            }}
          >
            <thead>
              <tr>
                <th style={th}>Día</th>
                <th style={th}>Hora inicio</th>
                <th style={th}>Hora fin</th>
              </tr>
            </thead>
            <tbody>
              {DAY_LABELS.map((dia, idx) => (
                <tr key={dia}>
                  <td style={td}>{dia}</td>
                  <td style={td}>
                    <input
                      type="time"
                      value={inputs[dia]?.inicio || ''}
                      onChange={e => handleChange(dia, 'inicio', e.target.value)}
                    />
                  </td>
                  <td style={td}>
                    <input
                      type="time"
                      value={inputs[dia]?.fin || ''}
                      onChange={e => handleChange(dia, 'fin', e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <button onClick={handleSave} style={btn}>
            Guardar disponibilidades
          </button>
          <button
            onClick={handleClear}
            style={{ ...btn, marginLeft: '1rem', background: '#c00' }}
          >
            Eliminar todo
          </button>
        </>
      )}
    </div>
  );
}

// estilos en línea para no añadir CSS
const th = { border: '1px solid #ccc', padding: '0.5rem', background: '#f7f7f7' };
const td = { border: '1px solid #ccc', padding: '0.5rem' };
const btn = {
  padding: '0.5rem 1rem',
  background: '#0066cc',
  color: 'white',
  border: 'none',
  cursor: 'pointer'
};