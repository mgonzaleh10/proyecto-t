import React, { useEffect, useMemo, useState } from 'react';
import { generarPython, previewPython, commitPython } from '../api/turnos';
import { getUsuarios } from '../api/usuarios';
import './HorariosPage.css'; // ← estilos Burger King

// Utilidades de fecha (sin cambios de lógica)
function parseYMDLocal(ymd){ const [y,m,d]=String(ymd).split('-').map(Number); return new Date(y,(m||1)-1,(d||1)); }
function addDaysLocal(d,n){ const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); x.setDate(x.getDate()+n); return x; }
function mondayOf(d){ const dow=d.getDay(); const diff=(dow===0?-6:1-dow); return addDaysLocal(d,diff); }
function fmtYMD(d){ const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function human(d){ return d.toLocaleDateString(); }

const LS_KEY_MAP = 'horarios.map';
const LS_KEY_MON = 'horarios.monday';

export default function HorariosPage(){
  // Mantiene el lunes visible y el mapa en localStorage (misma funcionalidad)
  const initialMonday = (() => {
    const ls = localStorage.getItem(LS_KEY_MON);
    return ls || fmtYMD(mondayOf(new Date()));
  })();

  const [monday,setMonday] = useState(initialMonday);
  const [usuarios,setUsuarios] = useState([]);
  const [scheduleMap,setScheduleMap] = useState(()=>{
    try{ return JSON.parse(localStorage.getItem(LS_KEY_MAP) || '{}'); }catch{ return {}; }
  });
  const [loading,setLoading] = useState(false);

  const days = useMemo(()=>{
    const b=parseYMDLocal(monday);
    return Array.from({length:7},(_,i)=> addDaysLocal(b,i));
  },[monday]);

  // Persistencia (sin cambios)
  useEffect(()=>{ localStorage.setItem(LS_KEY_MON, monday); },[monday]);
  useEffect(()=>{ localStorage.setItem(LS_KEY_MAP, JSON.stringify(scheduleMap)); },[scheduleMap]);

  useEffect(()=>{ (async()=>{
    try{
      const { data } = await getUsuarios();
      setUsuarios(data || []);
    }catch(e){
      console.error(e);
      alert('No se pudieron cargar los usuarios');
    }
  })(); },[]);

  const handleDateChange = (val) => {
    const mon = fmtYMD(mondayOf(parseYMDLocal(val))); // siempre normaliza a lunes
    setMonday(mon);
  };

  const handleGenerate = async() => {
    try{
      setLoading(true);
      await generarPython(monday);
      await loadPreview();
      alert('Preview cargado desde el Excel generado. Puedes editar y guardar.');
    }catch(e){
      console.error(e);
      alert(e?.response?.data?.error || e.message || 'Error generando horario');
    }finally{
      setLoading(false);
    }
  };

  const loadPreview = async() => {
    try{
      const { data } = await previewPython(monday); // carga todas las semanas
      const items = Array.isArray(data) ? data : (data?.items || []);
      if(!items.length){ alert('No hay filas en los Excel de salida.'); return; }

      const next = {};
      let minDate = null;
      for(const it of items){
        const uid   = Number(it.usuario_id);
        const fecha = String(it.fecha).slice(0,10);
        const inicio = String(it.hora_inicio || '').slice(0,5);
        const fin    = String(it.hora_fin    || '').slice(0,5);
        if(!uid || !fecha || !inicio || !fin) continue;

        if(!next[uid]) next[uid] = {};
        next[uid][fecha] = { inicio, fin };

        const d = parseYMDLocal(fecha);
        if(!minDate || d < minDate) minDate = d;
      }
      setScheduleMap(next);
      if(minDate) setMonday(fmtYMD(mondayOf(minDate)));
    }catch(e){
      console.error(e);
      alert(e?.response?.data?.error || e.message || 'Error cargando preview');
    }
  };

  const handleSave = async() => {
    try{
      const items = [];
      for(const uid of Object.keys(scheduleMap)){
        for(const ymd of Object.keys(scheduleMap[uid])){
          const cell = scheduleMap[uid][ymd] || {};
          if(cell.inicio && cell.fin){
            items.push({ usuario_id:Number(uid), fecha:ymd, hora_inicio:cell.inicio, hora_fin:cell.fin });
          }
        }
      }
      if(!items.length){ alert('No hay datos para guardar.'); return; }
      const { data } = await commitPython(items);
      alert(`Guardado OK. Insertados: ${data?.inserted ?? 0}`);
    }catch(e){
      console.error(e);
      alert(e?.response?.data?.error || e.message || 'Error guardando en BD');
    }
  };

  const onTimeChange = (uid, ymd, field, value) => {
    setScheduleMap(prev=>{
      const next = { ...prev };
      if(!next[uid]) next[uid] = {};
      next[uid][ymd] = { ...(next[uid][ymd] || {}), [field]: value };
      return next;
    });
  };

  // ==== Solo cambios de clases/estilos a partir de aquí ====
  return (
    <div className="horarios-container">
      <h2 className="horarios-title">Work Schedule 🍔</h2>

      <div className="horarios-controls">
        <label>
          Semana que inicia (lunes):{' '}
          <input
            type="date"
            value={monday}
            onChange={(e)=>handleDateChange(e.target.value)}
          />
        </label>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="horarios-btn btn-generate"
        >
          {loading ? 'Generando…' : 'Generar (Notebook)'}
        </button>

        <button
          onClick={loadPreview}
          className="horarios-btn btn-preview"
        >
          Cargar preview del Excel
        </button>

        <button
          onClick={handleSave}
          className="horarios-btn btn-save"
        >
          Guardar en BD
        </button>
      </div>

      <table className="horarios-table">
        <thead>
          <tr>
            <th>Crew / Día</th>
            {days.map(d => (
              <th key={+d}>{human(d)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {usuarios.map(u=>(
            <tr key={u.id}>
              <td>{u.nombre}</td>
              {days.map(d=>{
                const ymd = fmtYMD(d);
                const cell = scheduleMap[u.id]?.[ymd] || { inicio:'', fin:'' };
                return (
                  <td key={ymd}>
                    <div style={{ display:'flex', gap:'0.35rem', justifyContent:'center' }}>
                      <input
                        type="time"
                        value={cell.inicio}
                        onChange={e=>onTimeChange(u.id, ymd, 'inicio', e.target.value)}
                      />
                      <input
                        type="time"
                        value={cell.fin}
                        onChange={e=>onTimeChange(u.id, ymd, 'fin', e.target.value)}
                      />
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          {usuarios.length===0 && (
            <tr>
              <td colSpan={1+days.length}>No hay usuarios cargados.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
