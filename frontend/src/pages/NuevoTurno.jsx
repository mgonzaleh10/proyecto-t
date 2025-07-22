import React, { useState } from 'react'; // Importo React y useState
import { crearTurno } from '../api/turnos'; // Importo función para crear un turno

export default function NuevoTurno() {
  // Defino estado del formulario con valores por defecto
  const [form, setForm] = useState({
    usuario_id: '',
    fecha: '',
    hora_inicio: '',
    hora_fin: '',
    creado_por: '19',      // ← valor por defecto
    observaciones: ''
  });
  const [mensaje, setMensaje] = useState(null); // Estado para mostrar mensajes de éxito
  const [error, setError] = useState(null);     // Estado para mostrar errores

  // Actualizo el estado del formulario al cambiar inputs
  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  // Manejo el envío del formulario
  const handleSubmit = async e => {
    e.preventDefault();
    setMensaje(null);
    setError(null);
    const { usuario_id, fecha, hora_inicio, hora_fin } = form;
    // Valido campos obligatorios
    if (!usuario_id || !fecha || !hora_inicio || !hora_fin) {
      setError('Completa los campos obligatorios');
      return;
    }
    try {
      // Registro el turno en el backend
      const res = await crearTurno(form);
      setMensaje(`Turno creado con ID: ${res.data.id}`); // Muestro ID creado
      // Reinicio el formulario
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
      setError('Error al crear el turno'); // Muestro error si falla
    }
  };

  return (
    <div style={{ padding: '2rem' }}> {/* Contenedor principal */}
      <h2>Crear Turno Manual</h2> {/* Título de la sección */}

      <form onSubmit={handleSubmit} style={{ maxWidth: 400 }}>
        {/* Input de ID de crew */}
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

        {/* Input de fecha */}
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

        {/* Input de hora de inicio */}
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

        {/* Input de hora de fin */}
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

        {/* Campo oculto de creado_por */}
        <input
          type="hidden"
          name="creado_por"
          value={form.creado_por}
        />

        {/* Textarea de observaciones */}
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

        {/* Botón para crear turno */}
        <button type="submit" style={{ marginTop: '1rem' }}>
          Crear Turno
        </button>
      </form>

      {/* Muestro mensaje de éxito */}
      {mensaje && <p style={{ color: 'green' }}>{mensaje}</p>}
      {/* Muestro mensaje de error */}
      {error   && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}