import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getUsuarios } from '../api/usuarios';
import {
  getBeneficios,
  crearBeneficio,
  updateBeneficio,
  eliminarBeneficio
} from '../api/beneficios';

export default function BeneficiosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [beneficios, setBeneficios] = useState([]);
  const [form, setForm] = useState({
    tipo: 'cumpleaños',
    fecha: '',
    descripcion: ''
  });
  const [editingId, setEditingId] = useState(null);

  // 1) Cargo la lista de crews
  useEffect(() => {
    getUsuarios()
      .then(r => setUsuarios(r.data))
      .catch(console.error);
  }, []);

  // 2) Función para recargar beneficios (todos + filtro por usuario)
  const loadBeneficios = useCallback(() => {
    if (!selectedUser) {
      setBeneficios([]);
      return;
    }
    getBeneficios()
      .then(r => {
        // filtramos solo los de este usuario
        setBeneficios(r.data.filter(b => b.usuario_id === Number(selectedUser)));
      })
      .catch(console.error);
  }, [selectedUser]);

  // 3) Cuando cambie el crew seleccionado, recargo
  useEffect(() => {
    loadBeneficios();
  }, [loadBeneficios]);

  // Función auxiliar para contar cuántos de cierto tipo ya están asignados
  const countType = tipo =>
    beneficios.filter(b => b.tipo === tipo).length;

  // Validaciones antes de enviar
  const validar = () => {
    if (!form.fecha) {
      alert('Selecciona una fecha.');
      return false;
    }
    if (form.tipo === 'cumpleaños' && countType('cumpleaños') >= 1) {
      alert('Ya existe un cumpleaños asignado.');
      return false;
    }
    if (form.tipo === 'administrativo' && countType('administrativo') >= 2) {
      alert('Solo puedes asignar 2 días administrativos al año.');
      return false;
    }
    if (form.tipo === 'vacaciones' && countType('vacaciones') >= 4) {
      alert('Has consumido tus 4 semanas de vacaciones.');
      return false;
    }
    return true;
  };

  // Manejo de submit (crear o actualizar)
  const handleSubmit = async e => {
    e.preventDefault();
    if (!validar()) return;

    try {
      if (editingId) {
        // actualizar solo fecha y descripción
        await updateBeneficio(editingId, {
          fecha: form.fecha,
          descripcion: form.descripcion
        });
      } else {
        // crear nuevo beneficio, ojo al payload
        await crearBeneficio({
          id_usuario: Number(selectedUser),
          tipo: form.tipo,
          fecha: form.fecha,
          descripcion: form.descripcion
        });
      }
      // limpio formulario y recargo
      setForm({ tipo: 'cumpleaños', fecha: '', descripcion: '' });
      setEditingId(null);
      loadBeneficios();
    } catch (err) {
      console.error(err);
      alert('Error al guardar el beneficio.');
    }
  };

  // Empiezo edición
  const startEdit = b => {
    setEditingId(b.id);
    setForm({
      tipo: b.tipo,
      fecha: b.fecha.slice(0,10),
      descripcion: b.descripcion || ''
    });
  };

  // Borro un beneficio
  const handleDelete = async id => {
    if (!window.confirm('¿Eliminar este beneficio?')) return;
    try {
      await eliminarBeneficio(id);
      loadBeneficios();
    } catch {
      alert('Error al eliminar.');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Beneficios de los Crews</h2>
      <Link to="/usuarios">
        <button style={{ marginBottom: '1rem' }}>← Volver a Crews</button>
      </Link>

      {/* Selección de Crew */}
      <div style={{ marginBottom: '1rem' }}>
        <label>
          Selecciona Crew:
          <select
            value={selectedUser || ''}
            onChange={e => setSelectedUser(e.target.value || null)}
            style={{ marginLeft: '0.5rem' }}
          >
            <option value="">—</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.id}>
                {u.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Tabla de beneficios solo si hay crew seleccionado */}
      {selectedUser && (
        <>
          <table
            border="1"
            cellPadding="8"
            style={{ borderCollapse: 'collapse', width: '100%', marginBottom: '1rem' }}
          >
            <thead>
              <tr>
                <th>ID</th>
                <th>Tipo</th>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {beneficios.map(b => (
                <tr key={b.id}>
                  <td>{b.id}</td>
                  <td>
                    {b.tipo === 'cumpleaños'
                      ? 'Cumpleaños'
                      : b.tipo === 'administrativo'
                      ? 'Día administrativo'
                      : 'Vacaciones'}
                  </td>
                  <td>{new Date(b.fecha).toLocaleDateString()}</td>
                  <td>{b.descripcion || '—'}</td>
                  <td>
                    <button onClick={() => startEdit(b)}>✏️</button>
                    <button
                      onClick={() => handleDelete(b.id)}
                      style={{ marginLeft: '0.5rem' }}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Formulario de agregar / editar */}
          <form
            onSubmit={handleSubmit}
            style={{ border: '1px solid #ccc', padding: '1rem' }}
          >
            <h3>{editingId ? 'Editar' : 'Agregar'} Beneficio</h3>

            <div style={{ marginBottom: '0.5rem' }}>
              <label>
                Tipo:
                <select
                  name="tipo"
                  value={form.tipo}
                  onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
                  disabled={!!editingId}
                  style={{ marginLeft: '0.5rem' }}
                >
                  <option value="cumpleaños">Cumpleaños</option>
                  <option value="administrativo">Día administrativo</option>
                  <option value="vacaciones">Vacaciones</option>
                </select>
              </label>
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <label>
                Fecha:
                <input
                  type="date"
                  name="fecha"
                  value={form.fecha}
                  onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))}
                  style={{ marginLeft: '0.5rem' }}
                />
              </label>
            </div>

            <div style={{ marginBottom: '0.5rem' }}>
              <label>
                Descripción:
                <input
                  type="text"
                  name="descripcion"
                  value={form.descripcion}
                  onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Opcional"
                  style={{ marginLeft: '0.5rem', width: '60%' }}
                />
              </label>
            </div>

            <button type="submit">
              {editingId ? 'Guardar Cambios' : 'Agregar Beneficio'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm({ tipo: 'cumpleaños', fecha: '', descripcion: '' });
                }}
                style={{ marginLeft: '0.5rem' }}
              >
                Cancelar
              </button>
            )}
          </form>
        </>
      )}
    </div>
  );
}