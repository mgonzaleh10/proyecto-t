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
    <div style={{ padding: '2rem' }}>
      <h2>Beneficios de los Crews</h2>
      <Link to="/usuarios">
        <button style={{ marginBottom: '1rem' }}>← Volver a Crews</button>
      </Link>

      {/* Select Crew */}
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
              <option key={u.id} value={u.id}>{u.nombre}</option>
            ))}
          </select>
        </label>
      </div>

      {selectedUser && (
        <>
          {/* 1) Cumpleaños */}
          <section style={{ marginBottom: '2rem' }}>
            <h3>Cumpleaños</h3>
            {byType('cumpleaños').map(b => (
              <div key={b.id} style={{ marginBottom: '.5rem' }}>
                {new Date(b.fecha).toLocaleDateString()} &nbsp;
                <button onClick={() => {
                  setEditId(b.id);
                  setEditTipo('cumpleaños');
                  setCumpleForm({ fecha: b.fecha.slice(0,10), descripcion: b.descripcion || '' });
                }}>✏️</button>
                <button onClick={() => handleDelete(b.id)} style={{ marginLeft: '.5rem' }}>🗑️</button>
              </div>
            ))}
            {(byType('cumpleaños').length === 0 || editTipo === 'cumpleaños') && (
              <form onSubmit={e => {
                e.preventDefault();
                if (editId) return handleUpdate(editId, cumpleForm);
                handleCrear({ tipo: 'cumpleaños', ...cumpleForm });
              }}>
                <label>
                  Fecha:
                  <input
                    type="date"
                    required
                    value={cumpleForm.fecha}
                    onChange={e => setCumpleForm(f => ({ ...f, fecha: e.target.value }))}
                    style={{ margin: '0 .5rem' }}
                  />
                </label>
                <label>
                  Descripción:
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={cumpleForm.descripcion}
                    onChange={e => setCumpleForm(f => ({ ...f, descripcion: e.target.value }))}
                    style={{ margin: '0 .5rem' }}
                  />
                </label>
                <button type="submit">
                  {editId ? 'Guardar Cambios' : 'Agregar Cumpleaños'}
                </button>
                {editId && (
                  <button type="button" onClick={() => {
                    setEditId(null);
                    setEditTipo(null);
                    setCumpleForm({ fecha:'', descripcion:'' });
                  }} style={{ marginLeft: '.5rem' }}>
                    Cancelar
                  </button>
                )}
              </form>
            )}
          </section>

          {/* 2) Días administrativos */}
          <section style={{ marginBottom: '2rem' }}>
            <h3>Días Administrativos (Usados: {usedAdminCount}/2)</h3>
            {[0,1].map(slot => {
              const b = byType('administrativo')[slot];
              return (
                <div key={slot} style={{ marginBottom: '.5rem' }}>
                  Slot {slot+1}:&nbsp;
                  {b
                    ? (
                      <>
                        {new Date(b.fecha).toLocaleDateString()}
                        <button onClick={() => {
                          setEditId(b.id);
                          setEditTipo('administrativo');
                          setAdminForm({ visible: true, fecha: b.fecha.slice(0,10), descripcion: b.descripcion || '' });
                        }} style={{ marginLeft: '.5rem' }}>✏️</button>
                        <button onClick={() => handleDelete(b.id)} style={{ marginLeft: '.5rem' }}>🗑️</button>
                      </>
                    )
                    : (usedAdminCount < 2
                        ? <button onClick={() => setAdminForm(f => ({ ...f, visible: true }))}>
                            Reservar día administrativo
                          </button>
                        : <em>— límite alcanzado</em>
                      )
                  }
                </div>
              );
            })}

            {adminForm.visible && (
              <form onSubmit={e => {
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
                <label>
                  Fecha:
                  <input
                    type="date"
                    required
                    value={adminForm.fecha}
                    onChange={e => setAdminForm(f => ({ ...f, fecha: e.target.value }))}
                    style={{ margin: '0 .5rem' }}
                  />
                </label>
                <label>
                  Descripción:
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={adminForm.descripcion}
                    onChange={e => setAdminForm(f => ({ ...f, descripcion: e.target.value }))}
                    style={{ margin: '0 .5rem' }}
                  />
                </label>
                <button type="submit">
                  {editTipo==='administrativo' ? 'Guardar Cambios' : 'Agregar Día Administrativo'}
                </button>
                <button type="button" onClick={() => {
                  setAdminForm({ visible:false, fecha:'', descripcion:'' });
                  setEditId(null);
                  setEditTipo(null);
                }} style={{ marginLeft: '.5rem' }}>
                  Cancelar
                </button>
              </form>
            )}
          </section>

          {/* 3) Vacaciones */}
          <section>
            <h3>Vacaciones (Usados: {usedVacDays.length} días)</h3>
            <ul>
              {usedVacDays.map((d,i) => (
                <li key={i}>
                  {new Date(d).toLocaleDateString()}
                  <button onClick={() => handleDelete(beneficios.find(b=>b.tipo==='vacaciones'&&b.fecha===d).id)} style={{ marginLeft: '.5rem' }}>
                    🗑️
                  </button>
                </li>
              ))}
            </ul>

            <form onSubmit={async e => {
              e.preventDefault();
              // Insertar cada día en el rango
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
              <label>
                Desde:
                <input
                  type="date"
                  required
                  value={vacForm.start}
                  onChange={e => setVacForm(f => ({ ...f, start: e.target.value }))}
                  style={{ margin: '0 .5rem' }}
                />
              </label>
              <label>
                Hasta:
                <input
                  type="date"
                  required
                  value={vacForm.end}
                  onChange={e => setVacForm(f => ({ ...f, end: e.target.value }))}
                  style={{ margin: '0 .5rem' }}
                />
              </label>
              <label>
                Descripción:
                <input
                  type="text"
                  placeholder="Opcional"
                  value={vacForm.descripcion}
                  onChange={e => setVacForm(f => ({ ...f, descripcion: e.target.value }))}
                  style={{ margin: '0 .5rem' }}
                />
              </label>
              <button type="submit">Agregar Vacaciones</button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}