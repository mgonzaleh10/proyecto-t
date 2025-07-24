import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { getUsuarios } from '../api/usuarios';
import {
  getBeneficios,
  crearBeneficio,
  updateBeneficio,
  eliminarBeneficio
} from '../api/beneficios';

import './BeneficiosPage.css'; // Nuevo CSS

export default function BeneficiosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [beneficios, setBeneficios] = useState([]);

  // Forms
  const [cumpleForm,    setCumpleForm]    = useState({ fecha: '', descripcion: '' });
  const [adminForm,     setAdminForm]     = useState({ visible: false, fecha: '', descripcion: '' });
  const [vacForm,       setVacForm]       = useState({ start: '', end: '', descripcion: '' });

  // Editing helpers
  const [editId,        setEditId]        = useState(null);
  const [editTipo,      setEditTipo]      = useState(null);

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

  // Helpers: filter by type
  const byType = tipo => beneficios.filter(b => b.tipo === tipo);
  const usedAdminCount = byType('administrativo').length;
  const usedVacDays   = byType('vacaciones').map(b => b.fecha).sort();

  // Shared submit for cumpleaños & administrativo & vacaciones
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
    <div className="beneficios-container">
      <header className="beneficios-header">
        <h2>Beneficios de los Crews</h2>
        <Link to="/usuarios">
          <button className="btn btn-secondary">← Volver a Crews</button>
        </Link>
      </header>

      <div className="form-group">
        <label>Selecciona Crew:</label>
        <select
          value={selectedUser || ''}
          onChange={e => setSelectedUser(e.target.value || null)}
          className="select"
        >
          <option value="">—</option>
          {usuarios.map(u => (
            <option key={u.id} value={u.id}>{u.nombre}</option>
          ))}
        </select>
      </div>

      {selectedUser && (
        <>
          {/* Cumpleaños */}
          <section className="section-card">
            <h3>Cumpleaños</h3>
            {byType('cumpleaños').map(b => (
              <div key={b.id} className="item-row">
                <span>{new Date(b.fecha).toLocaleDateString()}</span>
                <div>
                  <button
                    className="btn-icon"
                    onClick={() => {
                      setEditId(b.id);
                      setEditTipo('cumpleaños');
                      setCumpleForm({ fecha: b.fecha.slice(0,10), descripcion: b.descripcion || '' });
                    }}
                  >✏️</button>
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => handleDelete(b.id)}
                  >🗑️</button>
                </div>
              </div>
            ))}
            {(byType('cumpleaños').length === 0 || editTipo === 'cumpleaños') && (
              <form className="form-inline" onSubmit={e => {
                e.preventDefault();
                if (editId) return handleUpdate(editId, cumpleForm);
                handleCrear({ tipo: 'cumpleaños', ...cumpleForm });
              }}>
                <input
                  type="date"
                  required
                  value={cumpleForm.fecha}
                  onChange={e => setCumpleForm(f => ({ ...f, fecha: e.target.value }))}
                />
                <input
                  type="text"
                  placeholder="Descripción opcional"
                  value={cumpleForm.descripcion}
                  onChange={e => setCumpleForm(f => ({ ...f, descripcion: e.target.value }))}
                />
                <button type="submit" className="btn btn-primary">
                  {editId ? 'Guardar Cambios' : 'Agregar Cumpleaños'}
                </button>
                {editId && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditId(null);
                      setEditTipo(null);
                      setCumpleForm({ fecha:'', descripcion:'' });
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </form>
            )}
          </section>

          {/* Días administrativos */}
          <section className="section-card">
            <h3>Días Administrativos ({usedAdminCount}/2)</h3>
            {[0,1].map(slot => {
              const b = byType('administrativo')[slot];
              return (
                <div key={slot} className="item-row">
                  <span>Slot {slot+1}:</span>
                  {b
                    ? <>
                        <span>{new Date(b.fecha).toLocaleDateString()}</span>
                        <div>
                          <button
                            className="btn-icon"
                            onClick={() => {
                              setEditId(b.id);
                              setEditTipo('administrativo');
                              setAdminForm({ visible: true, fecha: b.fecha.slice(0,10), descripcion: b.descripcion || '' });
                            }}
                          >✏️</button>
                          <button
                            className="btn-icon btn-danger"
                            onClick={() => handleDelete(b.id)}
                          >🗑️</button>
                        </div>
                      </>
                    : (usedAdminCount < 2
                        ? <button
                            className="btn btn-primary"
                            onClick={() => setAdminForm(f => ({ ...f, visible:true }))}
                          >
                            Reservar día administrativo
                          </button>
                        : <em className="text-muted">— límite alcanzado</em>
                      )
                  }
                </div>
              );
            })}
            {adminForm.visible && (
              <form className="form-inline" onSubmit={e => {
                e.preventDefault();
                if (editTipo==='administrativo' && editId) {
                  handleUpdate(editId, { fecha: adminForm.fecha, descripcion: adminForm.descripcion });
                } else {
                  handleCrear({ tipo:'administrativo', fecha: adminForm.fecha, descripcion: adminForm.descripcion });
                }
                setAdminForm({ visible:false, fecha:'', descripcion:'' });
                setEditId(null);
                setEditTipo(null);
              }}>
                <input
                  type="date"
                  required
                  value={adminForm.fecha}
                  onChange={e => setAdminForm(f => ({ ...f, fecha: e.target.value }))}
                />
                <input
                  type="text"
                  placeholder="Descripción opcional"
                  value={adminForm.descripcion}
                  onChange={e => setAdminForm(f => ({ ...f, descripcion: e.target.value }))}
                />
                <button type="submit" className="btn btn-primary">
                  {editTipo==='administrativo' ? 'Guardar Cambios' : 'Agregar Día Administrativo'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setAdminForm({ visible:false, fecha:'', descripcion:'' });
                    setEditId(null);
                    setEditTipo(null);
                  }}
                >
                  Cancelar
                </button>
              </form>
            )}
          </section>

          {/* Vacaciones */}
          <section className="section-card">
            <h3>Vacaciones ({usedVacDays.length} días usados)</h3>
            <ul className="vac-list">
              {usedVacDays.map((d,i) => (
                <li key={i}>
                  {new Date(d).toLocaleDateString()}
                  <button
                    className="btn-icon btn-danger"
                    onClick={() => handleDelete(beneficios.find(b=>b.tipo==='vacaciones'&&b.fecha===d).id)}
                  >🗑️</button>
                </li>
              ))}
            </ul>

            <form className="form-inline" onSubmit={async e => {
              e.preventDefault();
              const start = new Date(vacForm.start);
              const end   = new Date(vacForm.end);
              if (end < start) {
                alert('La fecha final no puede ser anterior a la inicial.');
                return;
              }
              let day = new Date(start);
              while (day <= end) {
                await crearBeneficio({
                  id_usuario: +selectedUser,
                  tipo: 'vacaciones',
                  fecha: day.toISOString().slice(0,10),
                  descripcion: vacForm.descripcion
                });
                day.setDate(day.getDate()+1);
              }
              setVacForm({ start:'', end:'', descripcion:'' });
              load();
            }}>
              <input
                type="date"
                required
                value={vacForm.start}
                onChange={e => setVacForm(f=>({...f,start:e.target.value}))}
              />
              <input
                type="date"
                required
                value={vacForm.end}
                onChange={e => setVacForm(f=>({...f,end:e.target.value}))}
              />
              <input
                type="text"
                placeholder="Descripción opcional"
                value={vacForm.descripcion}
                onChange={e => setVacForm(f=>({...f,descripcion:e.target.value}))}
              />
              <button type="submit" className="btn btn-primary">Agregar Vacaciones</button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}