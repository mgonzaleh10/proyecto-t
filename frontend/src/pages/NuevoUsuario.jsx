import React, { useState } from 'react';
import { crearUsuario } from '../api/usuarios';

export default function NuevoUsuario({ onNueva }) {
  const [form, setForm] = useState({
    nombre: '',
    correo: '',
    horas_contrato: 45,
    puede_cerrar: false,
  });
  const [error, setError] = useState(null);

  const handleChange = e => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError(null);
    try {
      await crearUsuario({
        ...form,
        contrasena: 'pass123'
      });
      setForm({ nombre:'', correo:'', horas_contrato:45, puede_cerrar:false });
      onNueva(); // recarga la lista
    } catch (err) {
      console.error(err);
      setError('Error al crear usuario');
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #ccc' }}>
      <h3>Agregar nuevo Crew</h3>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <div>
        <label>Nombre: 
          <input name="nombre" value={form.nombre} onChange={handleChange} required />
        </label>
      </div>
      <div>
        <label>Correo: 
          <input type="email" name="correo" value={form.correo} onChange={handleChange} required />
        </label>
      </div>
      <div>
        <label>Horas contrato: 
          <select name="horas_contrato" value={form.horas_contrato} onChange={handleChange}>
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
      <button type="submit" style={{ marginTop: '0.5rem' }}>➕ Crear Crew</button>
    </form>
  );
}