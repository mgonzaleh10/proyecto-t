import React, { useState } from 'react';
import { intercambio } from '../api/turnos';

export default function Intercambio() {
  const [form, setForm] = useState({
    usuario_id: '',
    fecha: '',
    hora_inicio: '',
    hora_fin: ''
  });
  const [recomendados, setRecomendados] = useState([]);
  const [error, setError] = useState(null);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    setRecomendados([]);
    // validación básica
    if (!form.usuario_id || !form.fecha || !form.hora_inicio || !form.hora_fin) {
      setError('Completa todos los campos');
      return;
    }
    try {
      const res = await intercambio(form);
      setRecomendados(res.data.recomendados || []);
    } catch (err) {
      console.error(err);
      setError('Error al solicitar recomendaciones');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Solicitar Intercambio de Turno</h2>
      <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
        <div>
          <label>
            Crew (usuario_id):
            <input
              type="number"
              name="usuario_id"
              value={form.usuario_id}
              onChange={handleChange}
              style={{ marginLeft: '0.5rem' }}
            />
          </label>
        </div>
        <div>
          <label>
            Fecha:
            <input
              type="date"
              name="fecha"
              value={form.fecha}
              onChange={handleChange}
              style={{ marginLeft: '0.5rem' }}
            />
          </label>
        </div>
        <div>
          <label>
            Hora inicio:
            <input
              type="time"
              name="hora_inicio"
              value={form.hora_inicio}
              onChange={handleChange}
              style={{ marginLeft: '0.5rem' }}
            />
          </label>
        </div>
        <div>
          <label>
            Hora fin:
            <input
              type="time"
              name="hora_fin"
              value={form.hora_fin}
              onChange={handleChange}
              style={{ marginLeft: '0.5rem' }}
            />
          </label>
        </div>
        <button type="submit" style={{ marginTop: '1rem' }}>
          Buscar recomendaciones
        </button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {recomendados.length > 0 && (
        <>
          <h3>Recomendaciones:</h3>
          <ul>
            {recomendados.map((r, i) => (
              <li key={i}>
                Crew <strong>{r.usuario_id}</strong> puede intercambiar con el turno de{' '}
                <em>{new Date(r.turnoDestino.fecha).toLocaleDateString()}</em> de{' '}
                {r.turnoDestino.hora_inicio} a {r.turnoDestino.hora_fin}
              </li>
            ))}
          </ul>
        </>
      )}

      {recomendados.length === 0 && !error && (
        <p>No se encontraron recomendaciones.</p>
      )}
    </div>
  );
}