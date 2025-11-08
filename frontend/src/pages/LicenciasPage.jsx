// src/pages/LicenciasPage.jsx
import React, { useEffect, useState } from "react";
import { getUsuarios } from "../api/usuarios";
import {
  crearLicencia,
  obtenerLicencias,
  eliminarLicencia,
} from "../api/licencias";
import "./LicenciasPage.css";

/** Formatea 'YYYY-MM-DD...' a 'DD/MM/YYYY' sin problemas de zona horaria */
const fmtDate = (s) =>
  s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—";

export default function LicenciasPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [licencias, setLicencias] = useState([]);
  const [form, setForm] = useState({
    usuario_id: "",
    fecha_inicio: "",
    fecha_fin: "",
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cargar usuarios y licencias al inicio
  useEffect(() => {
    const loadAll = async () => {
      try {
        const resUsers = await getUsuarios();     // Axios response
        setUsuarios(resUsers?.data || []);
        const lic = await obtenerLicencias();     // nuestra API ya devuelve data
        setLicencias(Array.isArray(lic) ? lic : []);
      } catch (e) {
        console.error(e);
        setError("No se pudieron cargar usuarios o licencias.");
      } finally {
        setLoading(false);
      }
    };
    loadAll();
  }, []);

  const handleChange = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validación básica
    if (!form.usuario_id || !form.fecha_inicio || !form.fecha_fin) {
      setError("Completa todos los campos.");
      return;
    }
    if (form.fecha_fin < form.fecha_inicio) {
      setError("La fecha de fin no puede ser anterior al inicio.");
      return;
    }

    try {
      await crearLicencia({
        usuario_id: Number(form.usuario_id),
        fecha_inicio: form.fecha_inicio, // YYYY-MM-DD
        fecha_fin: form.fecha_fin,       // YYYY-MM-DD
      });
      const lic = await obtenerLicencias();
      setLicencias(Array.isArray(lic) ? lic : []);
      setForm({ usuario_id: "", fecha_inicio: "", fecha_fin: "" });
    } catch (e) {
      console.error(e);
      setError("No se pudo crear la licencia.");
    }
  };

  const handleDelete = async (id) => {
    setError(null);
    try {
      await eliminarLicencia(id);
      const lic = await obtenerLicencias();
      setLicencias(Array.isArray(lic) ? lic : []);
    } catch (e) {
      console.error(e);
      setError("No se pudo eliminar la licencia.");
    }
  };

  return (
    <div className="lic-page">
      {/* Título estilo “marquesina” (igual familia que Home/Disponibilidades) */}
      <header className="lic-hero">
        <div className="lic-hero__inner">
          <h1 className="poster-title">LICENCIAS</h1>
          <p className="poster-sub">Registro de ausencias médicas por rango de fechas</p>
        </div>
      </header>

      <div className="lic-content">
        {error && <div className="lic-alert lic-alert--error">{error}</div>}
        {loading && <div className="lic-alert">Cargando…</div>}

        {/* Formulario */}
        <form className="lic-card lic-form" onSubmit={handleSubmit}>
          <div className="fi">
            <label>Crew</label>
            <select
              name="usuario_id"
              value={form.usuario_id}
              onChange={handleChange}
              required
            >
              <option value="">— Selecciona un usuario —</option>
              {Array.isArray(usuarios) &&
                usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
            </select>
          </div>

          <div className="fi">
            <label>Inicio</label>
            <input
              type="date"
              name="fecha_inicio"
              value={form.fecha_inicio}
              onChange={handleChange}
              required
            />
          </div>

          <div className="fi">
            <label>Fin</label>
            <input
              type="date"
              name="fecha_fin"
              value={form.fecha_fin}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-add">➕ Agregar licencia</button>
          </div>
        </form>

        {/* Tabla */}
        {Array.isArray(licencias) && licencias.length > 0 ? (
          <div className="lic-card">
            <table className="lic-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Usuario</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {licencias.map((l) => {
                  const user = usuarios.find((u) => u.id === l.usuario_id);
                  return (
                    <tr key={l.id}>
                      <td data-label="ID">{l.id}</td>
                      <td data-label="Usuario">{user ? user.nombre : l.usuario_id}</td>
                      <td data-label="Inicio">{fmtDate(l.fecha_inicio)}</td>
                      <td data-label="Fin">{fmtDate(l.fecha_fin)}</td>
                      <td data-label="Acciones">
                        <button
                          className="btn btn-danger btn-del"
                          onClick={() => handleDelete(l.id)}
                        >
                          🗑️ Eliminar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : !loading ? (
          <div className="lic-card lic-empty">No hay licencias registradas.</div>
        ) : null}
      </div>
    </div>
  );
}
