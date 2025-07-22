import React, { useState } from 'react'; // Importo React y useState
import { crearUsuario } from '../api/usuarios'; // Importo función para crear usuario

export default function NuevoUsuario({ onNueva }) {
  // Defino estado del formulario con valores iniciales, incluyendo birthday
  const [form, setForm] = useState({
    nombre: '',
    correo: '',
    horas_contrato: 45,
    puede_cerrar: false,
    cumpleaños: ''  // ← Nuevo campo
  });
  const [error, setError] = useState(null); // Estado para mostrar errores

  // Actualizo el estado del formulario al cambiar inputs
  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Manejo el envío del formulario
  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    try {
      // Registro el nuevo usuario en el backend, incluyendo cumpleaños
      await crearUsuario({
        nombre: form.nombre,
        correo: form.correo,
        horas_contrato: form.horas_contrato,
        puede_cerrar: form.puede_cerrar,
        cumpleaños: form.cumpleaños,
        contrasena: 'pass123' // Asigno contraseña por defecto
      });
      // Reinicio el formulario
      setForm({
        nombre: '',
        correo: '',
        horas_contrato: 45,
        puede_cerrar: false,
        cumpleaños: ''
      });
      onNueva(); // Notifico al padre que hay un nuevo usuario
    } catch (err) {
      console.error(err);
      setError('Error al crear usuario'); // Muestro error si falla
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #ccc' }}
    >
      <h3>Agregar nuevo Crew</h3>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div>
        <label>Nombre:
          <input
            name="nombre"
            value={form.nombre}
            onChange={handleChange}
            required
          />
        </label>
      </div>

      <div>
        <label>Correo:
          <input
            type="email"
            name="correo"
            value={form.correo}
            onChange={handleChange}
            required
          />
        </label>
      </div>

      <div>
        <label>Horas contrato:
          <select
            name="horas_contrato"
            value={form.horas_contrato}
            onChange={handleChange}
          >
            <option value={45}>45</option>
            <option value={30}>30</option>
            <option value={20}>20</option>
            <option value={16}>16</option>
          </select>
        </label>
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            name="puede_cerrar"
            checked={form.puede_cerrar}
            onChange={handleChange}
          /> Puede cerrar
        </label>
      </div>

      <div>
        <label>Cumpleaños:
          <input
            type="date"
            name="cumpleaños"
            value={form.cumpleaños}
            onChange={handleChange}
          />
        </label>
      </div>

      <button type="submit" style={{ marginTop: '0.5rem' }}>
        ➕ Crear Crew
      </button>
    </form>
  );
}