import React, { useState } from 'react';
import { crearTurno } from '../api/turnos';

export default function NuevoTurno() {
  const [form, setForm] = useState({
    usuario_id: '',
    fecha: '',
    hora_inicio: '',
    hora_fin: '',
    creado_por: '19',      // ← valor por defecto
    observaciones: ''
  });
  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);

  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setMensaje(null);
    setError(null);
    const { usuario_id, fecha, hora_inicio, hora_fin } = form;
    if (!usuario_id || !fecha || !hora_inicio || !hora_fin) {
      setError('Completa los campos obligatorios');
      return;
    }
    try {
      const res = await crearTurno(form);
      setMensaje(`Turno creado con ID: ${res.data.id}`);
      setForm({
        usuario_id: '',
        fecha: '',
        hora_inicio: '',
        hora_fin: '',
        creado_por: '19',
        observaciones: ''
      });
    } catch (err) {
      console.error(err);
      setError('Error al crear el turno');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Crear Turno Manual</h2>

      <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
        <label>
          Crew (ID):
          <input
            type="number"
            name="usuario_id"
            value={form.usuario_id}
            onChange={handleChange}
            required
          />
        </label>
        <br/>

        <label>
          Fecha:
          <input
            type="date"
            name="fecha"
            value={form.fecha}
            onChange={handleChange}
            required
          />
        </label>
        <br/>

        <label>
          Hora inicio:
          <input
            type="time"
            name="hora_inicio"
            value={form.hora_inicio}
            onChange={handleChange}
            required
          />
        </label>
        <br/>

        <label>
          Hora fin:
          <input
            type="time"
            name="hora_fin"
            value={form.hora_fin}
            onChange={handleChange}
            required
          />
        </label>
        <br/>

        {/* ocultamos el campo creado_por o lo dejamos solo lectura */}
        <input
          type="hidden"
          name="creado_por"
          value={form.creado_por}
        />

        <label>
          Observaciones:
          <textarea
            name="observaciones"
            value={form.observaciones}
            onChange={handleChange}
            rows="2"
          />
        </label>
        <br/>

        <button type="submit" style={{ marginTop: '1rem' }}>
          Crear Turno
        </button>
      </form>

      {mensaje && <p style={{ color: 'green' }}>{mensaje}</p>}
      {error   && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}