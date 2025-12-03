// src/pages/Intercambio.jsx
import React, { useEffect, useMemo, useState } from 'react';
import './Intercambio.css';

import { getUsuarios } from '../api/usuarios';
import {
  recomendarIntercambio,
  confirmarIntercambio,
  listarIntercambios
} from '../api/intercambios.jsx';
import { getTurnosPorFecha } from '../api/turnos';

export default function Intercambio() {
  // ====== Estados base ======
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState({
    usuario_id: '',
    turno_id: '', // se completa SOLO automáticamente
    fecha: '',
    hora_inicio: '', // se completa SOLO automáticamente
    hora_fin: '' // se completa SOLO automáticamente
  });

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState({ swaps: [], coberturas: [], debug: null });
  const [error, setError] = useState('');
  const [historial, setHistorial] = useState([]);

  // ====== Helpers de tiempo para clasificar por duración ======
  const minutesBetween = (t1, t2) => {
    if (!t1 || !t2) return null;
    const [h1, m1] = String(t1).split(':').map(Number);
    const [h2, m2] = String(t2).split(':').map(Number);
    if (Number.isNaN(h1) || Number.isNaN(h2)) return null;
    return h2 * 60 + m2 - (h1 * 60 + m1);
  };

  // Duración (en minutos) del turno de A
  const baseMinutes = useMemo(() => {
    if (!form.hora_inicio || !form.hora_fin) return null;
    return minutesBetween(form.hora_inicio, form.hora_fin);
  }, [form.hora_inicio, form.hora_fin]);

  // ====== Carga inicial ======
  useEffect(() => {
    getUsuarios()
      .then((r) => setUsuarios(r.data || []))
      .catch(() => {});
    listarIntercambios({})
      .then((r) => setHistorial(r.data || []))
      .catch(() => {});
  }, []);

  // ====== Helpers ======
  const usuarioMap = useMemo(() => {
    const m = new Map();
    usuarios.forEach((u) => m.set(u.id, u));
    return m;
  }, [usuarios]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({
      ...f,
      [name]: value,
      // si cambia trabajador o fecha, limpio turno detectado y resultados
      ...(name === 'usuario_id' || name === 'fecha'
        ? { turno_id: '', hora_inicio: '', hora_fin: '' }
        : {})
    }));
    setError('');
    setResp({ swaps: [], coberturas: [], debug: null });
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
      r?.turno_B_fecha ||
      r?.turnoBFecha ||
      r?.fechaB ||
      '';

    const inicioB =
      (r?.intercambio && (r.intercambio.inicioB || r.intercambio.hora_inicio_b)) ||
      r?.turno_B_inicio ||
      r?.turnoBInicio ||
      r?.inicioB ||
      '';

    const finB =
      (r?.intercambio && (r.intercambio.finB || r.intercambio.hora_fin_b)) ||
      r?.turno_B_fin ||
      r?.turnoBFin ||
      r?.finB ||
      '';

    const turnoDestinoId =
      (r?.intercambio && r.intercambio.turnoDestinoId) ||
      r?.turno_destino_id ||
      r?.turno_B_id ||
      r?.turnoBId ||
      null;

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
      if (!form.usuario_id || !form.fecha) {
        setError('Debes seleccionar trabajador y fecha.');
        return;
      }

      const usuarioId = Number(form.usuario_id);
      const fecha = form.fecha;

      // 1) Buscar el turno de ese trabajador en ese día
      const { data: turnosDia = [] } = await getTurnosPorFecha(fecha);
      const turnosUsuario = turnosDia.filter((t) => t.usuario_id === usuarioId);

      if (turnosUsuario.length === 0) {
        setError('Ese trabajador no tiene turno asignado ese día.');
        return;
      }

      if (turnosUsuario.length > 1) {
        setError(
          'Este trabajador tiene más de un turno ese día. Revisa la planilla manual.'
        );
        return;
      }

      const turno = turnosUsuario[0];
      const inicio = String(turno.hora_inicio).slice(0, 5);
      const fin = String(turno.hora_fin).slice(0, 5);
      const turnoId = turno.id;

      // Guardamos los datos detectados en el formulario (solo lectura lógica)
      setForm((f) => ({
        ...f,
        turno_id: turnoId,
        hora_inicio: inicio,
        hora_fin: fin
      }));

      // 2) Armar payload usando SIEMPRE el turno detectado
      const payload = {
        usuario_id: usuarioId,
        turno_id: turnoId,
        fecha,
        hora_inicio: inicio,
        hora_fin: fin
      };

      const { data } = await recomendarIntercambio(payload);
      setResp({
        swaps: data.swaps || [],
        coberturas: data.coberturas || [], // ya no se muestran, pero se guarda para debug
        debug: data.debug || null
      });
    } catch (err) {
      console.error(err);
      setError('No se pudieron obtener recomendaciones.');
    } finally {
      setLoading(false);
    }
  };

  // ====== Confirmar (solo swaps) ======
  const confirmar = async (cand) => {
    const isSwap = cand.tipo === 'swap';
    if (!isSwap) return;

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

        // Solo tiene sentido mover días libres si las fechas SON DISTINTAS
        // Caso típico:
        //  - A trabaja fechaA y B la tiene libre
        //  - B trabaja fechaB y A la tiene libre
        // Después del swap, se intercambian esos días libres.
        if (tB.fechaB && tB.fechaB !== form.fecha) {
          // Quitar libres donde ahora hay turno
          removeFree(uA, tB.fechaB);
          removeFree(uB, form.fecha);

          // Añadir libres donde ahora NO hay turno
          addFree(uA, form.fecha);
          addFree(uB, tB.fechaB);
        }

        localStorage.setItem(FREE_KEY, JSON.stringify(store));
      } catch (e) {
        console.warn('No se pudo actualizar freeMap tras el swap:', e);
      }

      alert('✅ Intercambio confirmado');
      listarIntercambios({})
        .then((r) => setHistorial(r.data || []))
        .catch(() => {});
    } catch {
      alert('❌ No se pudo confirmar');
    }
  };

  // ====== Datos para sección DEBUG ======
  const debug = resp.debug || {};

  const descartesEntriesRaw =
    debug && debug.descartes ? Object.entries(debug.descartes) : [];
  const descartesEntries = [...descartesEntriesRaw].sort(
    ([idA], [idB]) => Number(idA) - Number(idB)
  );

  const notasList = useMemo(
    () => (Array.isArray(debug.notas) ? debug.notas : []),
    [debug.notas]
  );

  const semanaInfo =
    Array.isArray(debug.pasos) &&
    debug.pasos.length > 0 &&
    debug.pasos[0].semana
      ? debug.pasos[0].semana
      : null;

  const prettyNote = (nota) => {
    const m = nota.match(/A[^0-9]*?(\d+):\s*(.+)$/i);
    const uidB = m ? Number(m[1]) : null;
    const reasonRaw = m ? m[2] : nota.replace(/^swap descartado\s*/i, '');

    const crewA = usuarioMap.get(Number(form.usuario_id));
    const crewAName = crewA ? `${crewA.nombre} (Crew A)` : 'El trabajador A';

    let crewBLabel = 'otro trabajador';
    if (uidB != null) {
      const crewB = usuarioMap.get(uidB);
      crewBLabel = crewB
        ? `${crewB.nombre} (ID ${uidB})`
        : `el trabajador con ID ${uidB}`;
    }

    return `${crewAName} no puede hacer cambio con ${crewBLabel} porque ${reasonRaw}.`;
  };

  // ====== Clasificación de swaps por duración ======
  const { swapsMismaDuracion, swapsOtraDuracion } = useMemo(() => {
    if (!baseMinutes || !Array.isArray(resp.swaps)) {
      return { swapsMismaDuracion: resp.swaps || [], swapsOtraDuracion: [] };
    }

    const same = [];
    const diff = [];

    resp.swaps.forEach((r) => {
      const tB = getTurnoB(r);
      const minsB = minutesBetween(tB.inicioB, tB.finB);
      if (minsB != null && minsB === baseMinutes) {
        same.push(r);
      } else {
        diff.push(r);
      }
    });

    return { swapsMismaDuracion: same, swapsOtraDuracion: diff };
  }, [resp.swaps, baseMinutes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ====== Vista ======
  return (
    <div className="intercambio-page bk-wrap">
      <header className="disp-hero">
        <h1 className="disp-title">INTERCAMBIOS DE TURNOS</h1>
        <p className="disp-sub">Gestiona cambios de turno de forma rápida y visual</p>
      </header>

      {/* FORM */}
      <section className="bk-section">
        <h2 className="sec-title">Turno a cambiar</h2>
        <form className="bk-form" onSubmit={onBuscar}>
          <div className="grid">
            <label className="field">
              <span>Trabajador (A)</span>
              <select
                name="usuario_id"
                value={form.usuario_id}
                onChange={handleChange}
                required
              >
                <option value="">— Elegir —</option>
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.horas_contrato}h)
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Fecha</span>
              <input
                type="date"
                name="fecha"
                value={form.fecha}
                onChange={handleChange}
                required
              />
            </label>
          </div>

          <div className="actions">
            <button className="btn-primary" disabled={loading}>
              {loading ? 'Buscando…' : 'Buscar opciones'}
            </button>
          </div>

          {error && <p className="bk-error">{error}</p>}

          {/* Si ya detectamos un turno, lo mostramos como referencia */}
          {form.turno_id && (
            <p className="turno-detectado">
              Turno detectado:&nbsp;
              <strong>{form.fecha}</strong> · {form.hora_inicio} — {form.hora_fin}
              &nbsp;(ID {form.turno_id})
            </p>
          )}
        </form>
      </section>

      {/* RESULTADOS */}
      <section className="bk-section">
        <h2 className="sec-title">Opciones encontradas</h2>

        <div className="cards">
          {/* COLUMNA 1: MISMA DURACIÓN */}
          <div className="card">
            <div className="card-head">
              <h3>Intercambios con misma duración</h3>
              <span className="pill">{swapsMismaDuracion.length}</span>
            </div>

            {swapsMismaDuracion.length === 0 && (
              <p className="empty">No hay intercambios con la misma duración.</p>
            )}

            {swapsMismaDuracion.map((r, i) => {
              const tB = getTurnoB(r);
              return (
                <div key={`sd-${i}`} className="item">
                  <div className="item-main">
                    <div className="who">
                      <strong>{r.nombre}</strong>{' '}
                      <em>({usuarioMap.get(r.usuario_id)?.horas_contrato || '?'}h)</em>
                    </div>
                    <div className="score">
                      <span
                        className={`badge ${
                          r.score >= 15 ? 'ok' : r.score >= 8 ? 'mid' : 'low'
                        }`}
                      >
                        Score {r.score}
                      </span>
                    </div>
                  </div>

                  <div className="swap-grid">
                    <div className="box">
                      <span className="label">TURNO A</span>
                      <div className="timing">
                        {form.fecha} · {form.hora_inicio} — {form.hora_fin}
                      </div>
                    </div>
                    <div className="box arrow">⇆</div>
                    <div className="box">
                      <span className="label">TURNO B</span>
                      <div className="timing">
                        {tB.fechaB
                          ? `${tB.fechaB} · ${tB.inicioB} — ${tB.finB}`
                          : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="motivo">{r.motivo}</div>

                  <div className="item-actions">
                    <button className="btn-ghost" onClick={() => confirmar(r)}>
                      Confirmar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* COLUMNA 2: DISTINTA DURACIÓN */}
          <div className="card">
            <div className="card-head">
              <h3>Intercambios con distinta duración</h3>
              <span className="pill">{swapsOtraDuracion.length}</span>
            </div>

            {swapsOtraDuracion.length === 0 && (
              <p className="empty">No hay intercambios con distinta duración.</p>
            )}

            {swapsOtraDuracion.map((r, i) => {
              const tB = getTurnoB(r);
              return (
                <div key={`od-${i}`} className="item">
                  <div className="item-main">
                    <div className="who">
                      <strong>{r.nombre}</strong>{' '}
                      <em>({usuarioMap.get(r.usuario_id)?.horas_contrato || '?'}h)</em>
                    </div>
                    <div className="score">
                      <span
                        className={`badge ${
                          r.score >= 15 ? 'ok' : r.score >= 8 ? 'mid' : 'low'
                        }`}
                      >
                        Score {r.score}
                      </span>
                    </div>
                  </div>

                  <div className="swap-grid">
                    <div className="box">
                      <span className="label">TURNO A</span>
                      <div className="timing">
                        {form.fecha} · {form.hora_inicio} — {form.hora_fin}
                      </div>
                    </div>
                    <div className="box arrow">⇆</div>
                    <div className="box">
                      <span className="label">TURNO B</span>
                      <div className="timing">
                        {tB.fechaB
                          ? `${tB.fechaB} · ${tB.inicioB} — ${tB.finB}`
                          : '—'}
                      </div>
                    </div>
                  </div>

                  <div className="motivo">{r.motivo}</div>

                  <div className="item-actions">
                    <button className="btn-ghost" onClick={() => confirmar(r)}>
                      Confirmar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* DEBUG bonito */}
        {resp.debug && (
          <details className="debug">
            <summary>Ver motivos de descarte</summary>
            <div className="debug-inner">
              {semanaInfo && (
                <div className="debug-section">
                  <h4>Semana analizada</h4>
                  <div className="debug-week">
                    <span className="pill-week">
                      {normalizeDate(semanaInfo.start)} &nbsp;→&nbsp;{' '}
                      {normalizeDate(semanaInfo.end)}
                    </span>
                  </div>
                </div>
              )}

              {descartesEntries.length > 0 && (
                <div className="debug-section">
                  <h4>Resumen por trabajador</h4>
                  <div className="debug-table">
                    {descartesEntries.map(([uid, motivo]) => {
                      const u = usuarioMap.get(Number(uid));
                      return (
                        <div key={uid} className="debug-row">
                          <span className="debug-user">
                            <span className="debug-user-id">ID {uid}</span>
                            {u && (
                              <span className="debug-user-name">· {u.nombre}</span>
                            )}
                          </span>
                          <span className="debug-reason">{motivo}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {notasList.length > 0 && (
                <div className="debug-section">
                  <h4>Notas detalladas</h4>
                  <ul className="debug-notes-list pretty">
                    {notasList.map((n, idx) => (
                      <li key={idx}>
                        <span className="note-bullet">•</span>
                        <span className="note-text">{prettyNote(n)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {descartesEntries.length === 0 && notasList.length === 0 && (
                <pre className="debug-raw">{JSON.stringify(resp.debug, null, 2)}</pre>
              )}
            </div>
          </details>
        )}
      </section>

      {/* HISTORIAL */}
      <section className="bk-section">
        <h2 className="sec-title">Historial de cambios/coberturas</h2>
        <div className="card">
          {historial.length === 0 && <p className="empty">Sin movimientos aún.</p>}
          {historial.slice(0, 8).map((h) => (
            <div key={h.id} className="hist-item">
              <div>
                <strong>#{h.id}</strong> ·{' '}
                <span className={`tag ${h.tipo}`}>{h.tipo}</span> ·{' '}
                <em>{h.estado}</em>
              </div>
              <div className="hist-meta">
                {h.solicitante_nombre} → {h.candidato_nombre} ·{' '}
                {new Date(h.fecha).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
