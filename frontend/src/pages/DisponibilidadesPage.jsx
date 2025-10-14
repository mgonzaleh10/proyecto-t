import React, { useState, useEffect } from 'react';
import { getUsuarios } from '../api/usuarios';
import {
  getDisponibilidades,
  crearDisponibilidad,
  eliminarDisponibilidad,
  eliminarTodasDisponibilidades
} from '../api/disponibilidades';

import './DisponibilidadesPage.css';

const DAY_LABELS = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];

export default function DisponibilidadesPage() {
  const [crews, setCrews] = useState([]);
  const [selectedCrew, setSelectedCrew] = useState('');
  const [inputs, setInputs] = useState({});
  const [saved, setSaved] = useState([]);

  // Carga inicial
  useEffect(() => {
    getUsuarios().then(r => setCrews(r.data)).catch(console.error);
    getDisponibilidades().then(r => setSaved(r.data)).catch(console.error);
  }, []);

  // Precarga inputs al cambiar de crew
  useEffect(() => {
    if (!selectedCrew) {
      setInputs({});
      return;
    }
    const byCrew = saved.filter(d => d.usuario_id === Number(selectedCrew));
    const map = {};
    byCrew.forEach(d => {
      map[d.dia_semana] = {
        inicio: d.hora_inicio.slice(0,5),
        fin:    d.hora_fin.slice(0,5),
        id:     d.id
      };
    });
    setInputs(map);
  }, [selectedCrew, saved]);

  const handleChange = (day, field, val) => {
    setInputs(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: val
      }
    }));
  };

  // Recargar disponibilidades
  const load = async () => {
    try {
      const r = await getDisponibilidades();
      setSaved(r.data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    if (!selectedCrew) {
      alert('Selecciona primero un crew.');
      return;
    }

    const crewId = Number(selectedCrew);
    const prevForCrew = saved.filter(d => d.usuario_id === crewId);

    const toDelete = [];
    const toCreate = [];

    // 1) Detectar borrados y modificaciones
    for (let d of prevForCrew) {
      const entry = inputs[d.dia_semana];
      if (!entry || !entry.inicio || !entry.fin) {
        toDelete.push(d.id);
      } else if (
        entry.inicio !== d.hora_inicio.slice(0,5) ||
        entry.fin    !== d.hora_fin.slice(0,5)
      ) {
        toDelete.push(d.id);
        toCreate.push({
          usuario_id: crewId,
          dia_semana: d.dia_semana,
          hora_inicio: entry.inicio,
          hora_fin:    entry.fin
        });
      }
    }

    // 2) Detectar sólo-nuevos (sin id)
    Object.entries(inputs).forEach(([dia_semana, v]) => {
      if (v.inicio && v.fin && !v.id) {
        toCreate.push({
          usuario_id: crewId,
          dia_semana,
          hora_inicio: v.inicio,
          hora_fin:    v.fin
        });
      }
    });

    // 3) Ejecutar eliminaciones
    for (let id of toDelete) {
      try { await eliminarDisponibilidad(id); }
      catch (e) { console.error('Error borrando:', e); }
    }

    // 4) Ejecutar creaciones
    if (toCreate.length > 0) {
      try {
        await crearDisponibilidad(toCreate);
        alert('Disponibilidades guardadas.');
      } catch (e) {
        console.error('Error creando:', e);
        alert('Error al guardar disponibilidades.');
      }
    } else {
      alert('No hay cambios nuevos para guardar.');
    }

    // 5) Recargar estado
    await load();
  };

  const handleClearAll = async () => {
    if (!window.confirm('¿Eliminar TODAS las disponibilidades?')) return;
    try {
      await eliminarTodasDisponibilidades();
      setSaved([]);
      setInputs({});
      alert('Todas las disponibilidades eliminadas.');
    } catch (e) {
      console.error(e);
      alert('Error al eliminar todas.');
    }
  };

  return (
    <div className="disp-page">
      {/* Título / Barra superior */}
      <div className="disp-toolbar">
        <h2>Disponibilidades</h2>
      </div>

      {/* Selector de Crew */}
      <div className="disp-card">
        <div className="disp-controls">
          <div className="fi">
            <label>Elige un crew</label>
            <select
              value={selectedCrew}
              onChange={e => setSelectedCrew(e.target.value)}
            >
              <option value="">— Seleccionar —</option>
              {crews.map(u => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Cuadro de edición por días */}
      {selectedCrew && (
        <div className="disp-card">
          <table className="disp-table">
            <thead>
              <tr>
                <th>Día</th>
                <th>Inicio</th>
                <th>Fin</th>
              </tr>
            </thead>
            <tbody>
              {DAY_LABELS.map(dia => (
                <tr key={dia}>
                  <td data-label="Día" className="col-day">{dia}</td>
                  <td data-label="Inicio">
                    <input
                      type="time"
                      value={inputs[dia]?.inicio || ''}
                      onChange={e => handleChange(dia, 'inicio', e.target.value)}
                    />
                  </td>
                  <td data-label="Fin">
                    <input
                      type="time"
                      value={inputs[dia]?.fin || ''}
                      onChange={e => handleChange(dia, 'fin', e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="disp-actions">
            <button className="btn btn-primary" onClick={handleSave}>
              Guardar disponibilidades
            </button>
            <button className="btn btn-danger" onClick={handleClearAll}>
              Eliminar todas
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
