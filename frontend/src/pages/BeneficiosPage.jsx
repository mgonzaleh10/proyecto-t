import React, { useState, useEffect, useCallback } from 'react';
import { getUsuarios } from '../api/usuarios';
import {
  getBeneficios,
  crearBeneficio,
  updateBeneficio,
  eliminarBeneficio
} from '../api/beneficios';

import './BeneficiosPage.css';

export default function BeneficiosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [beneficios, setBeneficios] = useState([]);

  // Forms
  const [cumpleForm, setCumpleForm] = useState({ fecha: '', descripcion: '' });
  const [adminForm,  setAdminForm]  = useState({ visible: false, fecha: '', descripcion: '' });
  const [vacForm,    setVacForm]    = useState({ start: '', end: '', descripcion: '' });

  // Editing helpers
  const [editId,   setEditId]   = useState(null);
  const [editTipo, setEditTipo] = useState(null);

  // Load crews once
  useEffect(() => {
    getUsuarios().then(r => setUsuarios(r.data)).catch(console.error);
  }, []);

  // Reload beneficios for selected user
  const load = useCallback(() => {
    if (!selectedUser) {
      setBeneficios([]);
      return;
    }
    getBeneficios()
      .then(r => {
        setBeneficios(r.data.filter(b => b.usuario_id === +selectedUser));
      })
      .catch(console.error);
  }, [selectedUser]);

  useEffect(() => {
    load();
  }, [load]);

  // Helpers
  const byType = tipo => beneficios.filter(b => b.tipo === tipo);
  const usedAdminCount = byType('administrativo').length;
  const usedVacDays = byType('vacaciones').map(b => b.fecha).sort();

  // CRUD helpers
  const handleCrear = async ({ tipo, fecha, descripcion }) => {
    await crearBeneficio({ id_usuario: +selectedUser, tipo, fecha, descripcion });
    load();
  };

  const handleUpdate = async (id, data) => {
    await updateBeneficio(id, data);
    setEditId(null);
    load();
  };

  const handleDelete = async id => {
    if (!window.confirm('¿Eliminar este beneficio?')) return;
    await eliminarBeneficio(id);
    load();
  };

  return (
    <div className="beneficios-page">
      {/* Encabezado afiche centrado */}
      <div className="beneficios-hero">
        <div className="hero-center">
          <h1>BENEFICIOS</h1>
          <p className="hero-sub">Cumpleaños • Administrativos • Vacaciones</p>
          <span className="hero-underline" />
        </div>
      </div>

      {/* Selector de usuario */}
      <div className="beneficios-card">
        <div className="beneficios-controls">
          <div className="fi">
            <label>Selecciona Crew</label>
            <select
              value={selectedUser || ''}
              onChange={e => setSelectedUser(e.target.value || null)}
            >
              <option value="">—</option>
              {usuarios.map(u => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Secciones */}
      {selectedUser && (
        <>
          {/* Cumpleaños */}
          <section className="beneficios-card">
            <div className="section-head">
              <h3><span className="s-icon">🎂</span> Cumpleaños</h3>
            </div>

            {byType('cumpleaños').map(b => (
              <div key={b.id} className="item-row">
                <span className="item-main">
                  {new Date(b.fecha).toLocaleDateString()}
                  {b.descripcion ? <em className="muted"> — {b.descripcion}</em> : null}
                </span>
                <div className="row-actions">
                  <button
                    className="btn-icon"
                    title="Editar"
                    onClick={() => {
                      setEditId(b.id);
                      setEditTipo('cumpleaños');
                      setCumpleForm({ fecha: b.fecha.slice(0, 10), descripcion: b.descripcion || '' });
                    }}
                  >✏️</button>
                  <button
                    className="btn-icon btn-danger"
                    title="Eliminar"
                    onClick={() => handleDelete(b.id)}
                  >🗑️</button>
                </div>
              </div>
            ))}

            {(byType('cumpleaños').length === 0 || editTipo === 'cumpleaños') && (
              <form
                className="form-inline"
                onSubmit={e => {
                  e.preventDefault();
                  if (editId) return handleUpdate(editId, cumpleForm);
                  handleCrear({ tipo: 'cumpleaños', ...cumpleForm });
                }}
              >
                <div className="fi">
                  <label>Fecha</label>
                  <input
                    type="date"
                    required
                    value={cumpleForm.fecha}
                    onChange={e => setCumpleForm(f => ({ ...f, fecha: e.target.value }))}
                  />
                </div>
                <div className="fi grow">
                  <label>Descripción (opcional)</label>
                  <input
                    type="text"
                    placeholder="Ej: turno libre, compartir torta, etc."
                    value={cumpleForm.descripcion}
                    onChange={e => setCumpleForm(f => ({ ...f, descripcion: e.target.value }))}
                  />
                </div>
                <div className="actions">
                  <button type="submit" className="btn btn-primary">
                    {editId ? 'Guardar cambios' : 'Agregar cumpleaños'}
                  </button>
                  {editId && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setEditId(null);
                        setEditTipo(null);
                        setCumpleForm({ fecha: '', descripcion: '' });
                      }}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            )}
          </section>

          {/* Días administrativos */}
          <section className="beneficios-card">
            <div className="section-head">
              <h3><span className="s-icon">🗂️</span> Días Administrativos <span className="pill">{usedAdminCount}/2</span></h3>
            </div>

            {[0, 1].map(slot => {
              const b = byType('administrativo')[slot];
              return (
                <div key={slot} className="item-row">
                  <span className="item-main">Slot {slot + 1}:</span>
                  {b ? (
                    <>
                      <span className="date-chip">{new Date(b.fecha).toLocaleDateString()}</span>
                      <div className="row-actions">
                        <button
                          className="btn-icon"
                          title="Editar"
                          onClick={() => {
                            setEditId(b.id);
                            setEditTipo('administrativo');
                            setAdminForm({ visible: true, fecha: b.fecha.slice(0, 10), descripcion: b.descripcion || '' });
                          }}
                        >✏️</button>
                        <button
                          className="btn-icon btn-danger"
                          title="Eliminar"
                          onClick={() => handleDelete(b.id)}
                        >🗑️</button>
                      </div>
                    </>
                  ) : (
                    <div className="row-actions">
                      {usedAdminCount < 2 ? (
                        <button
                          className="btn btn-primary"
                          onClick={() => setAdminForm(f => ({ ...f, visible: true }))}
                        >
                          Reservar día administrativo
                        </button>
                      ) : (
                        <em className="muted">— límite alcanzado</em>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {adminForm.visible && (
              <form
                className="form-inline"
                onSubmit={e => {
                  e.preventDefault();
                  if (editTipo === 'administrativo' && editId) {
                    handleUpdate(editId, { fecha: adminForm.fecha, descripcion: adminForm.descripcion });
                  } else {
                    handleCrear({ tipo: 'administrativo', fecha: adminForm.fecha, descripcion: adminForm.descripcion });
                  }
                  setAdminForm({ visible: false, fecha: '', descripcion: '' });
                  setEditId(null);
                  setEditTipo(null);
                }}
              >
                <div className="fi">
                  <label>Fecha</label>
                  <input
                    type="date"
                    required
                    value={adminForm.fecha}
                    onChange={e => setAdminForm(f => ({ ...f, fecha: e.target.value }))}
                  />
                </div>
                <div className="fi grow">
                  <label>Descripción (opcional)</label>
                  <input
                    type="text"
                    placeholder="Motivo o nota"
                    value={adminForm.descripcion}
                    onChange={e => setAdminForm(f => ({ ...f, descripcion: e.target.value }))}
                  />
                </div>
                <div className="actions">
                  <button type="submit" className="btn btn-primary">
                    {editTipo === 'administrativo' ? 'Guardar cambios' : 'Agregar día'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setAdminForm({ visible: false, fecha: '', descripcion: '' });
                      setEditId(null);
                      setEditTipo(null);
                    }}
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            )}
          </section>

          {/* Vacaciones */}
          <section className="beneficios-card">
            <div className="section-head">
              <h3><span className="s-icon">🏖️</span> Vacaciones <span className="pill">{usedVacDays.length} días</span></h3>
            </div>

            <ul className="vac-list">
              {usedVacDays.map((d, i) => (
                <li key={i}>
                  <span className="date-chip">{new Date(d).toLocaleDateString()}</span>
                  <button
                    className="btn-icon btn-danger"
                    title="Eliminar día"
                    onClick={() => handleDelete(beneficios.find(b => b.tipo === 'vacaciones' && b.fecha === d).id)}
                  >
                    🗑️
                  </button>
                </li>
              ))}
              {usedVacDays.length === 0 && <li className="muted">Sin días registrados.</li>}
            </ul>

            <form
              className="form-inline"
              onSubmit={async e => {
                e.preventDefault();
                const start = new Date(vacForm.start);
                const end = new Date(vacForm.end);
                if (end < start) {
                  alert('La fecha final no puede ser anterior a la inicial.');
                  return;
                }
                let day = new Date(start);
                while (day <= end) {
                  await crearBeneficio({
                    id_usuario: +selectedUser,
                    tipo: 'vacaciones',
                    fecha: day.toISOString().slice(0, 10),
                    descripcion: vacForm.descripcion
                  });
                  day.setDate(day.getDate() + 1);
                }
                setVacForm({ start: '', end: '', descripcion: '' });
                load();
              }}
            >
              <div className="fi">
                <label>Desde</label>
                <input
                  type="date"
                  required
                  value={vacForm.start}
                  onChange={e => setVacForm(f => ({ ...f, start: e.target.value }))}
                />
              </div>
              <div className="fi">
                <label>Hasta</label>
                <input
                  type="date"
                  required
                  value={vacForm.end}
                  onChange={e => setVacForm(f => ({ ...f, end: e.target.value }))}
                />
              </div>
              <div className="fi grow">
                <label>Descripción (opcional)</label>
                <input
                  type="text"
                  placeholder="Observación"
                  value={vacForm.descripcion}
                  onChange={e => setVacForm(f => ({ ...f, descripcion: e.target.value }))}
                />
              </div>
              <div className="actions">
                <button type="submit" className="btn btn-primary">Agregar vacaciones</button>
              </div>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
