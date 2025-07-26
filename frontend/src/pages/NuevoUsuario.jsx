import React, { useState } from 'react';
import { crearUsuario } from '../api/usuarios';
import './NuevoUsuario.css';

export default function NuevoUsuario({ onNueva }) {
  // Estado del formulario
  const [form, setForm] = useState({
    nombre: '',
    correo: '',
    horas_contrato: 45,
    puede_cerrar: false
  });
  const [error, setError] = useState(null);

  // Manejo cambios de inputs
  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Envía el formulario
  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    try {
      await crearUsuario({
        nombre: form.nombre,
        correo: form.correo,
        horas_contrato: form.horas_contrato,
        puede_cerrar: form.puede_cerrar,
        contrasena: 'pass123'
      });
      setForm({ nombre: '', correo: '', horas_contrato: 45, puede_cerrar: false });
      onNueva();
    } catch (err) {
      console.error(err);
      setError('Error al crear usuario');
    }
  };

  return (
    <form className="nuevo-crew-form" onSubmit={handleSubmit}>
      <h3 className="nuevo-crew-title">Agregar nuevo Crew</h3>
      {error && <div className="nuevo-crew-error">{error}</div>}

      <div className="nuevo-crew-row">
        <label htmlFor="nombre">Nombre:</label>
        <input
          id="nombre"
          name="nombre"
          value={form.nombre}
          onChange={handleChange}
          required
        />
      </div>

      <div className="nuevo-crew-row">
        <label htmlFor="correo">Correo:</label>
        <input
          id="correo"
          type="email"
          name="correo"
          value={form.correo}
          onChange={handleChange}
          required
        />
      </div>

      <div className="nuevo-crew-row">
        <label htmlFor="horas_contrato">Horas contrato:</label>
        <select
          id="horas_contrato"
          name="horas_contrato"
          value={form.horas_contrato}
          onChange={handleChange}
        >
          <option value={45}>45</option>
          <option value={30}>30</option>
          <option value={20}>20</option>
          <option value={16}>16</option>
        </select>
      </div>

      <div className="nuevo-crew-row checkbox-row">
        <label>
          <input
            type="checkbox"
            name="puede_cerrar"
            checked={form.puede_cerrar}
            onChange={handleChange}
          />
          Puede cerrar
        </label>
      </div>

      <div className="nuevo-crew-actions">
        <button type="submit" className="btn-create-crew">
          ➕ Crear Crew
        </button>
      </div>
    </form>
  );
}
