import React, { useState } from 'react'; // Importo React y useState
import { intercambio } from '../api/turnos'; // Importo API de intercambio

export default function Intercambio() {
  // Defino estado para el formulario de intercambio
  const [form, setForm] = useState({
    usuario_id: '',
    fecha: '',
    hora_inicio: '',
    hora_fin: ''
  });
  const [recomendados, setRecomendados] = useState([]); // Guardo recomendaciones
  const [error, setError] = useState(null); // Guardo mensaje de error

  // Actualizo estado al cambiar cualquier input
  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Manejo el envío del formulario
  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    setRecomendados([]);

    // Valido que todos los campos estén completos
    if (!form.usuario_id || !form.fecha || !form.hora_inicio || !form.hora_fin) {
      setError('Completa todos los campos');
      return;
    }

    try {
      // Solicito recomendaciones al backend
      const res = await intercambio(form);
      setRecomendados(res.data.recomendados || []); // Actualizo recomendaciones
    } catch (err) {
      console.error(err);
      setError('Error al solicitar recomendaciones'); // Seteo el error
    }
  };

  return (
    <div style={{ padding: '2rem' }}> {/* Contenedor principal */}
      <h2>Solicitar Intercambio de Turno</h2> {/* Título de la sección */}
      <form onSubmit={handleSubmit} style={{ marginBottom: '1.5rem' }}>
        {/* Input de ID de crew */}
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
        {/* Input de fecha */}
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
        {/* Input de hora de inicio */}
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
        {/* Input de hora de fin */}
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
        {/* Botón para enviar formulario */}
        <button type="submit" style={{ marginTop: '1rem' }}>
          Buscar recomendaciones
        </button>
      </form>

      {/* Muestro mensaje de error si existe */}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Muestro lista de recomendaciones si hay */}
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

      {/* Muestro mensaje si no hay recomendaciones y no hay error */}
      {recomendados.length === 0 && !error && (
        <p>No se encontraron recomendaciones.</p>
      )}
    </div>
  );
}