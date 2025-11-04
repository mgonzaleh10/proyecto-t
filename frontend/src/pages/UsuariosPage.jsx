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
      <div className="usuarios-toolbar">
        <h2>CREWS</h2>
        <p className="usuarios-sub">Listado, edición y alta de personal</p>
      </div>

      {error && <div className="alert-error">{error}</div>}

      <div className="usuarios-card">
        <NuevoUsuario onNueva={fetchUsuarios} />
      </div>

      <div className="usuarios-card">
        <table className="usuarios-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Horas Contrato</th>
              <th>Puede cerrar</th>
              <th>Acciones</th>
              <th>Más</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <React.Fragment key={u.id}>
                <tr>
                  <td data-label="ID">{u.id}</td>
                  <td data-label="Nombre">
                    {editId === u.id
                      ? <input className="in" name="nombre" value={editForm.nombre} onChange={handleEditChange} />
                      : <strong>{u.nombre}</strong>
                    }
                  </td>
                  <td data-label="Correo">
                    {editId === u.id
                      ? <input className="in" type="email" name="correo" value={editForm.correo} onChange={handleEditChange} />
                      : u.correo
                    }
                  </td>
                  <td data-label="Horas">
                    {editId === u.id
                      ? (
                        <select
                          className="in"
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
                  <td data-label="Cierre">
                    {editId === u.id
                      ? (
                        <label className="chk">
                          <input
                            type="checkbox"
                            name="puede_cerrar"
                            checked={editForm.puede_cerrar}
                            onChange={handleEditChange}
                          />
                          <span>Puede cerrar</span>
                        </label>
                      )
                      : (u.puede_cerrar ? <span className="badge-ok">Sí</span> : <span className="badge-warn">No</span>)
                    }
                  </td>
                  <td data-label="Acciones">
                    {editId === u.id
                      ? (
                        <div className="row-actions">
                          <button className="btn btn-primary" onClick={() => handleEditSubmit(u.id)}>💾 Guardar</button>
                          <button className="btn btn-secondary" onClick={() => setEditId(null)}>❌ Cancelar</button>
                        </div>
                      )
                      : (
                        <div className="row-actions">
                          <button className="btn btn-outline" onClick={() => handleEditClick(u)}>✏️ Editar</button>
                          <button className="btn btn-danger" onClick={() => handleDelete(u.id)}>🗑️ Eliminar</button>
                        </div>
                      )
                    }
                  </td>
                  <td data-label="Más">
                    <button className="btn btn-chip" onClick={() => toggleExpand(u.id)}>
                      {expandedId === u.id ? '▲ Ocultar' : '▼ Ver más'}
                    </button>
                  </td>
                </tr>

                {expandedId === u.id && (
                  <tr className="info-row">
                    <td colSpan="7">
                      <div className="info-panel">
                        <div className="info-photo">
                          <div className="photo-placeholder">[Foto de perfil]</div>
                          <button className="btn btn-outline small">Editar foto</button>
                        </div>
                        <div className="info-data">
                          <h3>{u.nombre}</h3>
                          <div className="kv">
                            <span>Correo</span>
                            <strong>{u.correo}</strong>
                          </div>
                          <div className="kv">
                            <span>Horas contrato</span>
                            <strong>{u.horas_contrato}</strong>
                          </div>
                          <div className="kv">
                            <span>Puede cerrar</span>
                            <strong>{u.puede_cerrar ? 'Sí' : 'No'}</strong>
                          </div>
                          <div className="kv">
                            <span>Tiempo en la empresa</span>
                            <strong>—</strong>
                          </div>
                          <div className="kv">
                            <span>Turnos de cierre</span>
                            <strong>—</strong>
                          </div>
                          <div className="kv">
                            <span>Turnos de apertura</span>
                            <strong>—</strong>
                          </div>
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
    </div>
  );
}
