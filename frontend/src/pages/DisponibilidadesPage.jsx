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
  // inputs para el formulario
  const [inputs, setInputs] = useState({});
  // guardamos lo que trae el servidor
  const [saved, setSaved] = useState([]);

  // 1) cargar crews y todas las disponibilidades
  useEffect(() => {
    getUsuarios().then(r => setCrews(r.data)).catch(console.error);
    reloadDisponibilidades();
  }, []);

  const reloadDisponibilidades = async () => {
    try {
      const r = await getDisponibilidades();
      setSaved(r.data);
    } catch (e) {
      console.error(e);
    }
  };

  // 2) cuando cambie de crew, precargamos sus disponibilidades
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

  // guarda las disponibilidades del crew seleccionado
  const handleSave = async () => {
    if (!selectedCrew) return alert('Selecciona primero un crew.');
    const payload = Object.entries(inputs)
      .filter(([_, v]) => v.inicio && v.fin)
      .map(([dia_semana, v]) => ({
        usuario_id: Number(selectedCrew),
        dia_semana,
        hora_inicio: v.inicio,
        hora_fin:    v.fin
      }));
    if (!payload.length) return alert('No hay disponibilidades para guardar.');
    try {
      await crearDisponibilidad(payload);
      alert('Disponibilidades guardadas.');
      await reloadDisponibilidades();
    } catch (e) {
      console.error(e);
      alert('Error al guardar.');
    }
  };

  // elimina TODAS las disponibilidades
  const handleClearAll = async () => {
    if (!window.confirm('¿Eliminar TODAS las disponibilidades?')) return;
    try {
      await eliminarTodasDisponibilidades();
      setInputs({});
      setSaved([]);
      alert('Todas las disponibilidades eliminadas.');
    } catch (e) {
      console.error(e);
      alert('Error al eliminar todo.');
    }
  };

  // elimina sólo las disponibilidades del crew actual
  const handleClearCrew = async () => {
    if (!selectedCrew) return;
    if (!window.confirm('¿Eliminar solo las disponibilidades de este crew?')) return;
    try {
      const toDelete = saved.filter(d => d.usuario_id === Number(selectedCrew));
      // borra cada registro individualmente
      await Promise.all(toDelete.map(d => eliminarDisponibilidad(d.id)));
      alert(`Disponibilidades del crew ${selectedCrew} eliminadas.`);
      await reloadDisponibilidades();
      setInputs({});
    } catch (e) {
      console.error(e);
      alert('Error al eliminar disponibilidades de este crew.');
    }
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
              {DAY_LABELS.map((dia) => (
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

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <button onClick={handleSave} style={btn}>
                Guardar disponibilidad
              </button>
              <button
                onClick={handleClearCrew}
                style={{ ...btn, marginLeft: '1rem', background: '#c60' }}
              >
                Eliminar disponibilidad de este crew
              </button>
            </div>
            <button
              onClick={handleClearAll}
              style={{ ...btn, background: '#c00' }}
            >
              Eliminar TODAS las disponibilidades
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// estilos en línea
const th = { border: '1px solid #ccc', padding: '0.5rem', background: '#f7f7f7' };
const td = { border: '1px solid #ccc', padding: '0.5rem' };
const btn = {
  padding: '0.5rem 1rem',
  background: '#0066cc',
  color: 'white',
  border: 'none',
  cursor: 'pointer'
};