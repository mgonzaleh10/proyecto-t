import React, { useState } from 'react'; // Importo React y useState
import { crearUsuario } from '../api/usuarios'; // Importo función para crear usuario

export default function NuevoUsuario({ onNueva }) {
  // Defino estado del formulario con valores iniciales
  const [form, setForm] = useState({
    nombre: '',
    correo: '',
    horas_contrato: 45,
    puede_cerrar: false,
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
      // Registro el nuevo usuario en el backend
      await crearUsuario({
        ...form,
        contrasena: 'pass123' // Asigno contraseña por defecto
      });
      // Reinicio el formulario
      setForm({ nombre:'', correo:'', horas_contrato:45, puede_cerrar:false });
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
      <h3>Agregar nuevo Crew</h3> {/* Título del formulario */}
      {/* Muestro error si existe */}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* Input de nombre */}
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

      {/* Input de correo */}
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

      {/* Select de horas de contrato */}
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

      {/* Checkbox de permiso para cerrar */}
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

      {/* Botón para crear nuevo crew */}
      <button type="submit" style={{ marginTop: '0.5rem' }}>
        ➕ Crear Crew
      </button>
    </form>
  );
}