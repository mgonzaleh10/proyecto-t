// src/pages/LicenciasPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { getUsuarios } from "../api/usuarios";
import {
  crearLicencia,
  obtenerLicencias,
  eliminarLicencia,
} from "../api/licencias";
import "./LicenciasPage.css";

/** 'YYYY-MM-DD...' -> 'DD/MM/YYYY' */
const fmtDate = (s) =>
  s ? String(s).slice(0, 10).split("-").reverse().join("/") : "—";

/** Diferencia en días entre dos fechas YYYY-MM-DD (inclusive) */
const diffDays = (d1, d2) => {
  if (!d1 || !d2) return 0;
  const a = new Date(d1 + "T00:00:00");
  const b = new Date(d2 + "T00:00:00");
  return Math.max(0, Math.round((b - a) / 86400000) + 1);
};

/** Estado de la licencia relativo a hoy */
const stateFromRange = (startYMD, endYMD) => {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, "0");
  const d = String(today.getDate()).padStart(2, "0");
  const todayYMD = `${y}-${m}-${d}`;
  if (endYMD < todayYMD) return "finalizada";
  if (startYMD > todayYMD) return "futura";
  return "activa";
};

export default function LicenciasPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [licencias, setLicencias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form alta
  const [form, setForm] = useState({
    usuario_id: "",
    fecha_inicio: "",
    fecha_fin: "",
  });

  // Filtros de la tabla
  const [filters, setFilters] = useState({
    q: "",
    desde: "",
    hasta: "",
    estado: "todas", // activa | futura | finalizada | todas
  });

  // Cargar usuarios y licencias
  useEffect(() => {
    const loadAll = async () => {
      try {
        const resUsers = await getUsuarios();
        setUsuarios(resUsers?.data || []);
        const lic = await obtenerLicencias();
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

  const handleChangeForm = (e) =>
    setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

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
        fecha_inicio: form.fecha_inicio,
        fecha_fin: form.fecha_fin,
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

  const changeFilter = (e) =>
    setFilters((f) => ({ ...f, [e.target.name]: e.target.value }));

  const getUserName = (id) =>
    usuarios.find((u) => u.id === id)?.nombre || `#${id}`;

  // Lista filtrada
  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return licencias.filter((l) => {
      const nombre = getUserName(l.usuario_id).toLowerCase();
      const matchQ = !q || nombre.includes(q);
      const matchDesde = !filters.desde || l.fecha_inicio >= filters.desde;
      const matchHasta = !filters.hasta || l.fecha_fin <= filters.hasta;
      const st = stateFromRange(l.fecha_inicio, l.fecha_fin);
      const matchEstado = filters.estado === "todas" || st === filters.estado;
      return matchQ && matchDesde && matchHasta && matchEstado;
    });
  }, [licencias, filters, usuarios]);

  // Stats
  const stats = useMemo(() => {
    let activa = 0,
      futura = 0,
      finalizada = 0;
    licencias.forEach((l) => {
      const st = stateFromRange(l.fecha_inicio, l.fecha_fin);
      if (st === "activa") activa++;
      else if (st === "futura") futura++;
      else finalizada++;
    });
    return { total: licencias.length, activa, futura, finalizada };
  }, [licencias]);

  return (
    <div className="lic-page">
      {/* Hero (mantiene tu título) */}
      <header className="lic-hero">
        <div className="lic-hero__inner">
          <h1 className="poster-title">LICENCIAS</h1>
          <p className="poster-sub">
            Registro de ausencias por rango de fechas • creación y gestión
          </p>
        </div>
      </header>

      <div className="lic-content">
        {error && <div className="lic-alert lic-alert--error">{error}</div>}
        {loading && <div className="lic-alert">Cargando…</div>}

        {/* Tarjetas resumen */}
        <section className="lic-stats">
          <div className="lic-stat">
            <span className="lic-stat__label">Activas</span>
            <span className="lic-stat__value">{stats.activa}</span>
            <span className="lic-stat__bar">
              <i style={{ width: stats.total ? `${(stats.activa / stats.total) * 100}%` : 0 }} />
            </span>
          </div>
          <div className="lic-stat">
            <span className="lic-stat__label">Próximas</span>
            <span className="lic-stat__value">{stats.futura}</span>
            <span className="lic-stat__bar">
              <i style={{ width: stats.total ? `${(stats.futura / stats.total) * 100}%` : 0 }} />
            </span>
          </div>
          <div className="lic-stat">
            <span className="lic-stat__label">Finalizadas</span>
            <span className="lic-stat__value">{stats.finalizada}</span>
            <span className="lic-stat__bar">
              <i style={{ width: stats.total ? `${(stats.finalizada / stats.total) * 100}%` : 0 }} />
            </span>
          </div>
        </section>

        {/* Barra de filtros */}
        <section className="lic-toolbar">
          <div className="field">
            <span style={{ fontWeight: 900 }}>Buscar</span>
            <input
              type="search"
              name="q"
              placeholder="Nombre…"
              value={filters.q}
              onChange={changeFilter}
            />
          </div>
          <div className="field">
            <span style={{ fontWeight: 900 }}>Desde</span>
            <input
              type="date"
              name="desde"
              value={filters.desde}
              onChange={changeFilter}
            />
          </div>
          <div className="field">
            <span style={{ fontWeight: 900 }}>Hasta</span>
            <input
              type="date"
              name="hasta"
              value={filters.hasta}
              onChange={changeFilter}
            />
          </div>
          <div className="field">
            <span style={{ fontWeight: 900 }}>Estado</span>
            <select name="estado" value={filters.estado} onChange={changeFilter}>
              <option value="todas">Todas</option>
              <option value="activa">Activas</option>
              <option value="futura">Próximas</option>
              <option value="finalizada">Finalizadas</option>
            </select>
          </div>
          <button
            className="btn btn-outline"
            onClick={() =>
              setFilters({ q: "", desde: "", hasta: "", estado: "todas" })
            }
            type="button"
          >
            Limpiar filtros
          </button>
        </section>

        {/* Formulario alta */}
        <form className="lic-card lic-form" onSubmit={handleSubmit}>
          <div className="fi">
            <label>Crew</label>
            <select
              name="usuario_id"
              value={form.usuario_id}
              onChange={handleChangeForm}
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
              onChange={handleChangeForm}
              required
            />
          </div>

          <div className="fi">
            <label>Fin</label>
            <input
              type="date"
              name="fecha_fin"
              value={form.fecha_fin}
              onChange={handleChangeForm}
              required
            />
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary btn-add">
              ➕ Agregar licencia
            </button>
          </div>
        </form>

        {/* Tabla */}
        {filtered.length > 0 ? (
          <div className="lic-card">
            <table className="lic-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Usuario</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Días</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => {
                  const nombre = getUserName(l.usuario_id);
                  const st = stateFromRange(l.fecha_inicio, l.fecha_fin);
                  const days = diffDays(l.fecha_inicio, l.fecha_fin);
                  return (
                    <tr key={l.id}>
                      <td data-label="ID">{l.id}</td>
                      <td data-label="Usuario" className="strong">{nombre}</td>
                      <td data-label="Inicio">{fmtDate(l.fecha_inicio)}</td>
                      <td data-label="Fin">{fmtDate(l.fecha_fin)}</td>
                      <td data-label="Días">{days}</td>
                      <td data-label="Estado">
                        <span className={`tag state--${st}`}><i />{st}</span>
                      </td>
                      <td data-label="Acciones">
                        <div className="actions">
                          <button
                            className="btn btn-danger btn-del"
                            onClick={() => handleDelete(l.id)}
                            type="button"
                          >
                            🗑️ Eliminar
                          </button>
                        </div>
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
