// src/pages/Intercambio.jsx
import React, { useEffect, useMemo, useState } from 'react';
import './Intercambio.css';

import { getUsuarios } from '../api/usuarios';
import { recomendarIntercambio, confirmarIntercambio, listarIntercambios } from '../api/intercambios.jsx';

export default function Intercambio() {
  // ====== Estados base ======
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({
    usuario_id: '',
    turno_id: '',         // opcional (si lo tienes, el backend usará ese turno exacto)
    fecha: '',
    hora_inicio: '',
    hora_fin: ''
  });

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState({ swaps: [], coberturas: [], debug: null });
  const [error, setError] = useState('');
  const [historial, setHistorial] = useState([]);

  // ====== Carga inicial ======
  useEffect(() => {
    getUsuarios().then(r => setUsuarios(r.data || [])).catch(() => {});
    listarIntercambios({}).then(r => setHistorial(r.data || [])).catch(() => {});
  }, []);

  // ====== Helpers ======
  const usuarioMap = useMemo(() => {
    const m = new Map();
    usuarios.forEach(u => m.set(u.id, u));
    return m;
  }, [usuarios]);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  // Normaliza fecha "YYYY-MM-DD"
  const normalizeDate = (v) => {
    if (!v) return '';
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    if (typeof v === 'string' && v.includes('T')) return v.slice(0, 10);
    return String(v);
  };

  // Extrae datos del Turno B soportando ambos formatos de backend
  const getTurnoB = (r) => {
    const fechaB =
      (r?.intercambio && (r.intercambio.fechaB || r.intercambio.fecha_b)) ||
      r?.turno_B_fecha || r?.turnoBFecha || r?.fechaB || '';

    const inicioB =
      (r?.intercambio && (r.intercambio.inicioB || r.intercambio.hora_inicio_b)) ||
      r?.turno_B_inicio || r?.turnoBInicio || r?.inicioB || '';

    const finB =
      (r?.intercambio && (r.intercambio.finB || r.intercambio.hora_fin_b)) ||
      r?.turno_B_fin || r?.turnoBFin || r?.finB || '';

    const turnoDestinoId =
      (r?.intercambio && r.intercambio.turnoDestinoId) ||
      r?.turno_destino_id || r?.turno_B_id || r?.turnoBId || null;

    return {
      fechaB: normalizeDate(fechaB),
      inicioB: inicioB || '',
      finB: finB || '',
      turnoDestinoId
    };
  };

  // ====== Buscar recomendaciones ======
  const onBuscar = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setResp({ swaps: [], coberturas: [], debug: null });
    try {
      const payload = {
        usuario_id: Number(form.usuario_id),
        turno_id: form.turno_id ? Number(form.turno_id) : null,
        fecha: form.fecha,
        hora_inicio: form.hora_inicio,
        hora_fin: form.hora_fin
      };
      const { data } = await recomendarIntercambio(payload);
      setResp({
        swaps: data.swaps || [],
        coberturas: data.coberturas || [],
        debug: data.debug || null
      });
    } catch (err) {
      setError('No se pudieron obtener recomendaciones.');
    } finally {
      setLoading(false);
    }
  };

  // ====== Confirmar (solo swaps; coberturas ya no tienen botón) ======
  const confirmar = async (cand) => {
    const isSwap = cand.tipo === 'swap';
    if (!isSwap) return; // blindaje por si se llama accidentalmente

    const uA = Number(form.usuario_id);
    const uB = cand.usuario_id;
    const tB = getTurnoB(cand);

    const confirmMsg =
      `Confirmar INTERCAMBIO real:\n\nA (ID ${uA}) cede su turno ${form.fecha} ${form.hora_inicio}-${form.hora_fin}\n` +
      `B (${cand.nombre}) cede su turno ${tB.fechaB} ${tB.inicioB}-${tB.finB}\n\n¿Deseas confirmar?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const payload = {
        tipo: 'swap',
        turno_origen_id: form.turno_id ? Number(form.turno_id) : null,
        usuario_solicitante: uA,
        usuario_candidato: uB,
        fecha: form.fecha,
        hora_inicio: form.hora_inicio,
        hora_fin: form.hora_fin,
        turno_destino_id: tB.turnoDestinoId
      };

      await confirmarIntercambio(payload);

      // 🔄 Sincronizar días LIBRES (freeMap) con el swap realizado
      try {
        const FREE_KEY = 'freeMap';
        const raw = localStorage.getItem(FREE_KEY) || '{}';
        const store = JSON.parse(raw);

        const removeFree = (uid, fecha) => {
          if (!uid || !fecha) return;
          const key = String(uid);
          if (!store[key]) return;
          const setFechas = new Set(store[key]);
          setFechas.delete(fecha);
          store[key] = Array.from(setFechas);
          if (store[key].length === 0) delete store[key];
        };

        const addFree = (uid, fecha) => {
          if (!uid || !fecha) return;
          const key = String(uid);
          const setFechas = new Set(store[key] || []);
          setFechas.add(fecha);
          store[key] = Array.from(setFechas);
        };

        // Situación después del swap:
        // - A tiene turno en fechaB  -> NO libre ese día
        // - B tiene turno en fechaA  -> NO libre ese día
        // - A queda libre en fechaA  -> LIBRE
        // - B queda libre en fechaB  -> LIBRE

        // Quitar libres donde ahora hay turno
        removeFree(uA, tB.fechaB);
        removeFree(uB, form.fecha);

        // Añadir libres donde ahora NO hay turno
        addFree(uA, form.fecha);
        addFree(uB, tB.fechaB);

        localStorage.setItem(FREE_KEY, JSON.stringify(store));
      } catch (e) {
        console.warn('No se pudo actualizar freeMap tras el swap:', e);
      }

      alert('✅ Intercambio confirmado');
      listarIntercambios({}).then(r => setHistorial(r.data || [])).catch(() => {});
    } catch {
      alert('❌ No se pudo confirmar');
    }
  };

  // ====== Vista ======
  return (
    <div className="intercambio-page bk-wrap">
      <header className="disp-hero">
        <h1 className="disp-title">INTERCAMBIOS Y COBERTURAS</h1>
        <p className="disp-sub">Gestiona cambios de turno de forma rápida y visual</p>
      </header>

      {/* FORM */}
      <section className="bk-section">
        <h2 className="sec-title">Turno a cambiar</h2>
        <form className="bk-form" onSubmit={onBuscar}>
          <div className="grid">
            <label className="field">
              <span>Trabajador (A)</span>
              <select name="usuario_id" value={form.usuario_id} onChange={handleChange} required>
                <option value="">— Elegir —</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre} ({u.horas_contrato}h)</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Fecha</span>
              <input type="date" name="fecha" value={form.fecha} onChange={handleChange} required/>
            </label>

            <label className="field">
              <span>Inicio</span>
              <input type="time" name="hora_inicio" value={form.hora_inicio} onChange={handleChange} required/>
            </label>

            <label className="field">
              <span>Fin</span>
              <input type="time" name="hora_fin" value={form.hora_fin} onChange={handleChange} required/>
            </label>

            <label className="field">
              <span>ID Turno (opcional)</span>
              <input
                type="number"
                name="turno_id"
                placeholder="Ej: 287"
                value={form.turno_id}
                onChange={handleChange}
              />
              <small>Opcional</small>
            </label>
          </div>

          <div className="actions">
            <button className="btn-primary" disabled={loading}>
              {loading ? 'Buscando…' : 'Buscar opciones'}
            </button>
          </div>

          {error && <p className="bk-error">{error}</p>}
        </form>
      </section>

      {/* RESULTADOS */}
      <section className="bk-section">
        <h2 className="sec-title">Opciones encontradas</h2>

        <div className="cards">
          {/* SWAPS */}
          <div className="card">
            <div className="card-head">
              <h3>Intercambios reales (preferidos)</h3>
              <span className="pill">{resp.swaps.length}</span>
            </div>

            {resp.swaps.length === 0 && <p className="empty">No hay intercambios reales esta semana.</p>}

            {resp.swaps.map((r, i) => {
              const tB = getTurnoB(r);
              return (
                <div key={`s-${i}`} className="item">
                  <div className="item-main">
                    <div className="who">
                      <strong>{r.nombre}</strong> <em>({usuarioMap.get(r.usuario_id)?.horas_contrato || '?'}h)</em>
                    </div>
                    <div className="score">
                      <span className={`badge ${r.score >= 15 ? 'ok' : r.score >= 8 ? 'mid' : 'low'}`}>
                        Score {r.score}
                      </span>
                    </div>
                  </div>

                  <div className="swap-grid">
                    <div className="box">
                      <span className="label">TURNO A</span>
                      <div className="timing">{form.fecha} · {form.hora_inicio} — {form.hora_fin}</div>
                    </div>
                    <div className="box arrow">⇆</div>
                    <div className="box">
                      <span className="label">TURNO B</span>
                      <div className="timing">
                        {tB.fechaB ? `${tB.fechaB} · ${tB.inicioB} — ${tB.finB}` : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="motivo">{r.motivo}</div>

                  <div className="item-actions">
                    <button className="btn-ghost" onClick={() => confirmar(r)}>Confirmar</button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* COBERTURAS (sin botón Confirmar) */}
          <div className="card">
            <div className="card-head">
              <h3>Coberturas</h3>
              <span className="pill">{resp.coberturas.length}</span>
            </div>

            {resp.coberturas.length === 0 && <p className="empty">No hay coberturas para ese turno.</p>}

            {resp.coberturas.map((r, i) => (
              <div key={`c-${i}`} className="item">
                <div className="item-main">
                  <div className="who">
                    <strong>{r.nombre}</strong> <em>({usuarioMap.get(r.usuario_id)?.horas_contrato || '?'}h)</em>
                  </div>
                  <div className="score">
                    <span className={`badge ${r.score >= 12 ? 'ok' : r.score >= 6 ? 'mid' : 'low'}`}>
                      Score {r.score}
                    </span>
                  </div>
                </div>

                <div className="timing">{form.fecha} · {form.hora_inicio} — {form.hora_fin}</div>
                <div className="motivo">{r.motivo}</div>

                {/* Sin acciones en coberturas */}
              </div>
            ))}
          </div>
        </div>

        {/* DEBUG opcional */}
        {resp.debug && (
          <details className="debug">
            <summary>Ver motivos de descarte</summary>
            <pre>{JSON.stringify(resp.debug, null, 2)}</pre>
          </details>
        )}
      </section>

      {/* HISTORIAL */}
      <section className="bk-section">
        <h2 className="sec-title">Historial de cambios/coberturas</h2>
        <div className="card">
          {historial.length === 0 && <p className="empty">Sin movimientos aún.</p>}
          {historial.slice(0,8).map(h => (
            <div key={h.id} className="hist-item">
              <div>
                <strong>#{h.id}</strong> · <span className={`tag ${h.tipo}`}>{h.tipo}</span> · <em>{h.estado}</em>
              </div>
              <div className="hist-meta">
                {h.solicitante_nombre} → {h.candidato_nombre} · {new Date(h.fecha).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
