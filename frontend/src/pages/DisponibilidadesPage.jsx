import React, { useState, useEffect } from 'react'; // Importo React y hooks
import { getUsuarios } from '../api/usuarios'; // Importo función para obtener crews
import {
  getDisponibilidades,
  crearDisponibilidad,
  eliminarDisponibilidad,
  eliminarTodasDisponibilidades
} from '../api/disponibilidades'; // Importo API de disponibilidades

const DAY_LABELS = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];

export default function DisponibilidadesPage() {
  // Estado para lista de crews
  const [crews, setCrews] = useState([]);
  // Estado para crew seleccionado
  const [selectedCrew, setSelectedCrew] = useState('');
  // Estado para inputs de horario: { día: { inicio, fin, id } }
  const [inputs, setInputs] = useState({});
  // Estado para disponibilidades que vienen del servidor
  const [saved, setSaved] = useState([]);

  // 1) Al montar, obtengo crews y disponibilidades
  useEffect(() => {
    getUsuarios()
      .then(r => setCrews(r.data))   // Guardo lista de crews
      .catch(console.error);
    getDisponibilidades()
      .then(r => setSaved(r.data))   // Guardo disponibilidades
      .catch(console.error);
  }, []);

  // 2) Cuando cambia selectedCrew, precargo sus disponibilidades en inputs
  useEffect(() => {
    if (!selectedCrew) {
      setInputs({}); // Si no hay crew, limpio inputs
      return;
    }
    // Filtro disponibilidades del crew seleccionado
    const byCrew = saved.filter(d => d.usuario_id === Number(selectedCrew));
    const map = {};
    byCrew.forEach(d => {
      map[d.dia_semana] = {
        inicio: d.hora_inicio.slice(0,5),
        fin:    d.hora_fin.slice(0,5),
        id:     d.id
      };
    });
    setInputs(map); // Cargo inputs con datos precargados
  }, [selectedCrew, saved]);

  // Manejo cambio de inputs de hora
  const handleChange = (day, field, val) => {
    setInputs(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: val
      }
    }));
  };

  // 3) Guardar disponibilidades: borro y creo según inputs
  const handleSave = async () => {
    if (!selectedCrew) {
      alert('Selecciona primero un crew.');
      return;
    }

    // 3.a) Borro de la BD las disponibilidades que quité
    const prevForCrew = saved.filter(d => d.usuario_id === Number(selectedCrew));
    for (let d of prevForCrew) {
      const entry = inputs[d.dia_semana];
      if (!entry || !entry.inicio || !entry.fin) {
        try {
          await eliminarDisponibilidad(d.id); // Borro disposición
        } catch (e) {
          console.error('Error borrando disponibilidad:', e);
        }
      }
    }

    // 3.b) Construyo payload solo con días que tengan inicio+fin
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
    } else {
      try {
        await crearDisponibilidad(payload); // Creo disponibilidades nuevas
        alert('Disponibilidades guardadas.');
      } catch (e) {
        console.error(e);
        alert('Error al guardar disponibilidades.');
      }
    }

    // 3.c) Recargo la lista completa después de guardar
    try {
      const r = await getDisponibilidades();
      setSaved(r.data);
    } catch (e) {
      console.error(e);
    }
  };

  // Eliminar todas las disponibilidades
  const handleClearAll = async () => {
    if (!window.confirm('¿Eliminar TODAS las disponibilidades?')) return;
    try {
      await eliminarTodasDisponibilidades(); // Borro todo
      setSaved([]);  // Limpio estado local
      setInputs({}); // Limpio inputs
      alert('Eliminadas todas.');
    } catch (e) {
      console.error(e);
      alert('Error al eliminar todo.');
    }
  };

  return (
    <div style={{ padding: '2rem' }}> {/* Renderizo contenedor principal */}
      <h2>Configuración de Disponibilidades</h2> {/* Título de la página */}

      <div style={{ marginBottom: '1rem' }}>
        {/* Selector de crew */}
        <label>
          Elige un crew:
          <select
            value={selectedCrew}
            onChange={e => setSelectedCrew(e.target.value)} // Actualizo crew seleccionado
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
          {/* Tabla de inputs por día */}
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
              {DAY_LABELS.map(dia => (
                <tr key={dia}>
                  <td style={td}>{dia}</td>
                  <td style={td}>
                    {/* Input de hora inicio */}
                    <input
                      type="time"
                      value={inputs[dia]?.inicio || ''}
                      onChange={e => handleChange(dia, 'inicio', e.target.value)}
                    />
                  </td>
                  <td style={td}>
                    {/* Input de hora fin */}
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

          {/* Botones de acción */}
          <button onClick={handleSave} style={btn}>
            Guardar disponibilidades
          </button>
          <button
            onClick={handleClearAll}
            style={{ ...btn, marginLeft: '1rem', background: '#c00' }}
          >
            Eliminar todo
          </button>
        </>
      )}
    </div>
  );
}

// Estilos en línea para tabla y botones
const th = { border: '1px solid #ccc', padding: '0.5rem', background: '#f7f7f7' };
const td = { border: '1px solid #ccc', padding: '0.5rem' };
const btn = {
  padding: '0.5rem 1rem',
  background: '#0066cc',
  color: 'white',
  border: 'none',
  cursor: 'pointer'
};