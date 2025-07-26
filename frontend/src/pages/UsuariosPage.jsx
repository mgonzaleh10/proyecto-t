// src/pages/UsuariosPage.jsx

import React, { useEffect, useState } from 'react';
import { getUsuarios, updateUsuario, eliminarUsuario } from '../api/usuarios';
import NuevoUsuario from './NuevoUsuario';
import './UsuariosPage.css';

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [error, setError] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({
    nombre: '',
    correo: '',
    horas_contrato: 45,
    puede_cerrar: false
  });
  const [expandedId, setExpandedId] = useState(null);

  const fetchUsuarios = async () => {
    try {
      const res = await getUsuarios();
      setUsuarios(res.data);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los usuarios.');
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm(
      '¿Estás seguro de eliminar este crew? Se borrarán también sus disponibilidades, beneficios y turnos asociados. Esta acción NO se puede deshacer.'
    )) return;

    try {
      await eliminarUsuario(id);
      setUsuarios(u => u.filter(x => x.id !== id));
    } catch (err) {
      console.error(err);
      alert('Error al eliminar');
    }
  };

  const handleEditClick = (u) => {
    setEditId(u.id);
    setEditForm({
      nombre: u.nombre,
      correo: u.correo,
      horas_contrato: u.horas_contrato,
      puede_cerrar: u.puede_cerrar
    });
    setError(null);
  };

  const handleEditChange = e => {
    const { name, value, type, checked } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleEditSubmit = async (id) => {
    try {
      const res = await updateUsuario(id, editForm);
      setUsuarios(uList =>
        uList.map(u => (u.id === id ? res.data : u))
      );
      setEditId(null);
    } catch (err) {
      console.error(err);
      setError('Error al editar usuario');
    }
  };

  const toggleExpand = (id) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  return (
    <div className="usuarios-page">
      <h2>Gestión de Crews</h2>
      {error && <p className="error">{error}</p>}

      <NuevoUsuario onNueva={fetchUsuarios} />

      <table className="usuarios-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Horas Contrato</th>
            <th>Puede cerrar</th>
            <th>Acciones</th>
            <th>Más información</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map(u => (
            <React.Fragment key={u.id}>
              <tr>
                <td>{u.id}</td>
                <td>
                  {editId === u.id
                    ? <input name="nombre" value={editForm.nombre} onChange={handleEditChange} />
                    : u.nombre
                  }
                </td>
                <td>
                  {editId === u.id
                    ? <input type="email" name="correo" value={editForm.correo} onChange={handleEditChange} />
                    : u.correo
                  }
                </td>
                <td>
                  {editId === u.id
                    ? (
                      <select
                        name="horas_contrato"
                        value={editForm.horas_contrato}
                        onChange={handleEditChange}
                      >
                        <option value={45}>45</option>
                        <option value={30}>30</option>
                        <option value={20}>20</option>
                        <option value={16}>16</option>
                      </select>
                    )
                    : u.horas_contrato
                  }
                </td>
                <td>
                  {editId === u.id
                    ? <input
                        type="checkbox"
                        name="puede_cerrar"
                        checked={editForm.puede_cerrar}
                        onChange={handleEditChange}
                      />
                    : (u.puede_cerrar ? 'Sí' : 'No')
                  }
                </td>
                <td>
                  {editId === u.id
                    ? (
                      <>
                        <button onClick={() => handleEditSubmit(u.id)}>💾 Guardar</button>
                        <button onClick={() => setEditId(null)} style={{ marginLeft: '0.5rem' }}>❌ Cancelar</button>
                      </>
                    )
                    : (
                      <>
                        <button onClick={() => handleEditClick(u)}>✏️ Editar</button>
                        <button onClick={() => handleDelete(u.id)} style={{ marginLeft: '0.5rem' }}>🗑️ Eliminar</button>
                      </>
                    )
                  }
                </td>
                <td>
                  <button onClick={() => toggleExpand(u.id)}>
                    {expandedId === u.id ? '▲ Ocultar' : '▼ Ver más'}
                  </button>
                </td>
              </tr>

              {expandedId === u.id && (
                <tr className="info-row">
                  <td colSpan="7">
                    <div className="info-panel">
                      {/* Aquí va el layout base que mostraste */}
                      <div className="info-photo">
                        <div className="photo-placeholder">[Foto de perfil]</div>
                        <button className="edit-photo-btn">Editar foto</button>
                      </div>
                      <div className="info-data">
                        <h3>{u.nombre}</h3>
                        <p><strong>Correo:</strong> {u.correo}</p>
                        <p><strong>Horas contrato:</strong> {u.horas_contrato}</p>
                        <p><strong>P. cierre:</strong> {u.puede_cerrar ? 'Sí' : 'No'}</p>
                        {/* placeholder para tiempo en la empresa */}
                        <p><strong>Tiempo en la empresa:</strong> -- días</p>
                        {/* placeholder para stats de turnos */}
                        <p><strong>Turnos de cierre:</strong> --</p>
                        <p><strong>Turnos de apertura:</strong> --</p>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
