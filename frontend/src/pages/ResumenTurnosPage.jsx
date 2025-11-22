// src/pages/ResumenTurnosPage.jsx
import React, { useState } from 'react';
import { getResumenTurnos } from '../api/resumenTurnos';
import './ResumenTurnosPage.css';

const fmtNumber = (n) =>
  typeof n === 'number' ? n.toLocaleString('es-CL', { maximumFractionDigits: 1 }) : '0';

const toNum = (v) => (typeof v === 'number' ? v : Number(v) || 0);

export default function ResumenTurnosPage() {
  const [fechas, setFechas] = useState({
    fechaInicio: '',
    fechaFin: ''
  });
  const [resumen, setResumen] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchResumen = async () => {
    setError(null);

    if (!fechas.fechaInicio || !fechas.fechaFin) {
      setError('Debes seleccionar ambas fechas.');
      return;
    }
    if (fechas.fechaFin < fechas.fechaInicio) {
      setError('La fecha final no puede ser anterior a la inicial.');
      return;
    }

    try {
      setLoading(true);
      const { data } = await getResumenTurnos({
        fechaInicio: fechas.fechaInicio,
        fechaFin: fechas.fechaFin
      });
      setResumen(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setError('No se pudo cargar el resumen.');
    } finally {
      setLoading(false);
    }
  };

  // Derivados
  const totalTurnos = resumen.reduce((acc, r) => acc + toNum(r.total_turnos), 0);
  const totalCierres = resumen.reduce((acc, r) => acc + toNum(r.cierres), 0);
  const totalAperturas = resumen.reduce((acc, r) => acc + toNum(r.aperturas), 0);

  // 🔥 ahora solo sumamos los cambios SOLICITADOS
  const totalCambios = resumen.reduce(
    (acc, r) => acc + toNum(r.intercambios_solicitante),
    0
  );

  const sortedByCierres = [...resumen].sort(
    (a, b) => toNum(b.cierres) - toNum(a.cierres)
  );
  const sortedByAperturas = [...resumen].sort(
    (a, b) => toNum(b.aperturas) - toNum(a.aperturas)
  );

  // 🔥 ordenar SOLO por cambios solicitados
  const sortedByCambios = [...resumen].sort(
    (a, b) => toNum(b.intercambios_solicitante) - toNum(a.intercambios_solicitante)
  );

  const topCierres = sortedByCierres.slice(0, 3).filter((r) => toNum(r.cierres) > 0);
  const topAperturas = sortedByAperturas.slice(0, 3).filter((r) => toNum(r.aperturas) > 0);

  // 🔥 top solo considerando quien solicitó cambios
  const topCambios = sortedByCambios
    .slice(0, 3)
    .filter((r) => toNum(r.intercambios_solicitante) > 0);

  return (
    <div className="res-page">
      <header className="res-hero">
        <div className="res-hero-inner">
          <h1 className="res-title">RESUMEN DE TURNOS</h1>
          <p className="res-sub">Analiza aperturas, cierres e intercambios por periodo</p>
        </div>
      </header>

      <main className="res-content">
        <section className="res-card res-filters">
          <div className="res-filters-grid">
            <div className="fi">
              <label>Desde (incluye)</label>
              <input
                type="date"
                value={fechas.fechaInicio}
                onChange={(e) =>
                  setFechas((f) => ({ ...f, fechaInicio: e.target.value }))
                }
              />
            </div>
            <div className="fi">
              <label>Hasta (incluye)</label>
              <input
                type="date"
                value={fechas.fechaFin}
                onChange={(e) =>
                  setFechas((f) => ({ ...f, fechaFin: e.target.value }))
                }
              />
            </div>
            <div className="fi fi-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={fetchResumen}
                disabled={loading}
              >
                {loading ? 'Cargando…' : 'Cargar resumen'}
              </button>
            </div>
          </div>

          {error && <div className="res-alert res-alert--error">{error}</div>}
        </section>

        {resumen.length > 0 && (
          <>
            {/* KPIs */}
            <section className="res-kpis">
              <div className="kpi">
                <span className="kpi-label">Total turnos</span>
                <span className="kpi-value">{totalTurnos}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Total cierres</span>
                <span className="kpi-value">{totalCierres}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Total aperturas</span>
                <span className="kpi-value">{totalAperturas}</span>
              </div>
              <div className="kpi">
                <span className="kpi-label">Cambios de turno</span>
                <span className="kpi-value">{totalCambios}</span>
              </div>
            </section>

            {/* TOPs */}
            <section className="res-tops">
              <div className="top-card">
                <h3>Más turnos de cierre</h3>
                {topCierres.length === 0 && <p className="res-empty">Sin cierres.</p>}
                <ol>
                  {topCierres.map((r, idx) => (
                    <li key={r.usuario_id}>
                      <span className="top-rank">#{idx + 1}</span>
                      <span className="top-name">{r.nombre}</span>
                      <span className="top-badge">{toNum(r.cierres)} cierres</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="top-card">
                <h3>Más turnos de apertura</h3>
                {topAperturas.length === 0 && <p className="res-empty">Sin aperturas.</p>}
                <ol>
                  {topAperturas.map((r, idx) => (
                    <li key={r.usuario_id}>
                      <span className="top-rank">#{idx + 1}</span>
                      <span className="top-name">{r.nombre}</span>
                      <span className="top-badge">{toNum(r.aperturas)} aperturas</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="top-card">
                <h3>Más cambios de turno (solicitados)</h3>
                {topCambios.length === 0 && <p className="res-empty">Sin solicitudes.</p>}
                <ol>
                  {topCambios.map((r, idx) => (
                    <li key={r.usuario_id}>
                      <span className="top-rank">#{idx + 1}</span>
                      <span className="top-name">{r.nombre}</span>
                      <span className="top-badge">
                        {toNum(r.intercambios_solicitante)} cambios
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            {/* TABLA DETALLE */}
            <section className="res-card">
              <h3 className="res-table-title">Detalle por crew</h3>
              <div className="res-table-wrapper">
                <table className="res-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Crew</th>
                      <th>Turnos</th>
                      <th>Aperturas</th>
                      <th>Cierres</th>
                      <th>Horas totales</th>
                      <th>Días trabajados</th>
                      <th>Cambios (solicitados)</th>
                      <th>Cambios (como apoyo)</th>
                      {/* ❌ columna quitada */}
                    </tr>
                  </thead>

                  <tbody>
                    {resumen.map((r, idx) => {
                      const horasTot = toNum(r.horas_totales);
                      const totalT = toNum(r.total_turnos);
                      const horasProm = totalT ? horasTot / totalT : 0;

                      return (
                        <tr key={r.usuario_id}>
                          <td>{idx + 1}</td>
                          <td className="strong">{r.nombre}</td>
                          <td>{totalT}</td>
                          <td>{toNum(r.aperturas)}</td>
                          <td>{toNum(r.cierres)}</td>
                          <td>
                            {fmtNumber(horasTot)}h
                            <span className="sub">
                              {' '}
                              (≈ {fmtNumber(horasProm)}h/turno)
                            </span>
                          </td>
                          <td>{toNum(r.dias_distintos)}</td>
                          <td>{toNum(r.intercambios_solicitante)}</td>
                          <td>{toNum(r.intercambios_candidato)}</td>
                          {/* ❌ columna de cambios totales ELIMINADA */}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        {!loading && resumen.length === 0 && !error && (
          <section className="res-card res-empty-block">
            Selecciona un rango de fechas y presiona
            <strong> “Cargar resumen”</strong>
          </section>
        )}
      </main>
    </div>
  );
}
