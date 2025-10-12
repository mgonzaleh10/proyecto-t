import React, { useEffect, useMemo, useState } from 'react';
import { generarPython, previewPython, commitPython } from '../api/turnos';
import { getUsuarios } from '../api/usuarios';

function parseYMDLocal(ymd){ const [y,m,d]=String(ymd).split('-').map(Number); return new Date(y,(m||1)-1,(d||1)); }
function addDaysLocal(d,n){ const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); x.setDate(x.getDate()+n); return x; }
function mondayOf(d){ const dow=d.getDay(); const diff=(dow===0?-6:1-dow); return addDaysLocal(d,diff); }
function fmtYMD(d){ const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function human(d){ return d.toLocaleDateString(); }

const LS_KEY_MAP = 'horarios.map';
const LS_KEY_MON = 'horarios.monday';

export default function HorariosPage(){
  const initialMonday = (() => {
    const ls = localStorage.getItem(LS_KEY_MON);
    return ls || fmtYMD(mondayOf(new Date()));
  })();

  const [monday,setMonday]=useState(initialMonday);
  const [usuarios,setUsuarios]=useState([]);
  const [scheduleMap,setScheduleMap]=useState(()=>{
    try{ return JSON.parse(localStorage.getItem(LS_KEY_MAP)||'{}'); }catch{ return {}; }
  });
  const [loading,setLoading]=useState(false);

  const days = useMemo(()=>{
    const b=parseYMDLocal(monday);
    return Array.from({length:7},(_,i)=> addDaysLocal(b,i));
  },[monday]);

  // Persistencia en localStorage
  useEffect(()=>{ localStorage.setItem(LS_KEY_MON, monday); },[monday]);
  useEffect(()=>{ localStorage.setItem(LS_KEY_MAP, JSON.stringify(scheduleMap)); },[scheduleMap]);

  useEffect(()=>{ (async()=>{
    try{ const { data } = await getUsuarios(); setUsuarios(data||[]); }
    catch(e){ console.error(e); alert('No se pudieron cargar los usuarios'); }
  })(); },[]);

  const handleDateChange = (val) => {
    const mon = fmtYMD(mondayOf(parseYMDLocal(val)));
    setMonday(mon);
  };

  const handleGenerate=async()=>{
    try{
      setLoading(true);
      await generarPython(monday);
      await loadPreview();
      alert('Preview cargado desde el Excel generado. Puedes editar y guardar.');
    }catch(e){
      console.error(e);
      alert(e?.response?.data?.error || e.message || 'Error generando horario');
    }finally{ setLoading(false); }
  };

  // Carga TODAS las semanas (todas las hojas / archivos); usa monday como hint para la 1ª
  const loadPreview=async()=>{
    try{
      const { data } = await previewPython(monday);
      const items = Array.isArray(data) ? data : (data?.items || []);
      if(!items.length){ alert('No hay filas en los Excel de salida.'); return; }

      const next={};
      let minDate=null;
      for(const it of items){
        const uid = Number(it.usuario_id);
        const fecha = String(it.fecha).slice(0,10);
        const inicio = String(it.hora_inicio||'').slice(0,5);
        const fin    = String(it.hora_fin||'').slice(0,5);
        if(!uid || !fecha || !inicio || !fin) continue;
        if(!next[uid]) next[uid]={};
        next[uid][fecha] = { inicio, fin };

        const d=parseYMDLocal(fecha);
        if(!minDate || d<minDate) minDate=d;
      }
      setScheduleMap(next);
      if(minDate) setMonday(fmtYMD(mondayOf(minDate)));
    }catch(e){
      console.error(e);
      alert(e?.response?.data?.error || e.message || 'Error cargando preview');
    }
  };

  const handleSave=async()=>{
    try{
      const items=[];
      for(const uid of Object.keys(scheduleMap)){
        for(const ymd of Object.keys(scheduleMap[uid])){
          const cell=scheduleMap[uid][ymd]||{};
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

  const onTimeChange=(uid,ymd,field,value)=>{
    setScheduleMap(prev=>{
      const next={...prev};
      if(!next[uid]) next[uid]={};
      next[uid][ymd]={ ...(next[uid][ymd]||{}), [field]:value };
      return next;
    });
  };

  return (
    <div style={{ fontFamily:'Arial', maxWidth:1200, margin:'1.5rem auto' }}>
      <h2>Horarios (Notebook → Excel → Preview)</h2>

      <div style={{ display:'flex', gap:'0.75rem', alignItems:'center', marginBottom:'1rem' }}>
        <label>
          Semana que inicia (lunes):{' '}
          <input type="date" value={monday} onChange={(e)=>handleDateChange(e.target.value)} />
        </label>

        <button onClick={handleGenerate} disabled={loading}
          style={{ background:'#a8562b', color:'#fff', padding:'0.5rem 0.75rem', borderRadius:6, border:'none' }}>
          {loading ? 'Generando…' : 'Generar (Notebook)'}
        </button>

        <button onClick={loadPreview}
          style={{ background:'#b56930', color:'#fff', padding:'0.5rem 0.75rem', borderRadius:6, border:'none' }}>
          Cargar preview del Excel
        </button>

        <button onClick={handleSave}
          style={{ background:'#2e7d32', color:'#fff', padding:'0.5rem 0.75rem', borderRadius:6, border:'none' }}>
          Guardar en BD
        </button>
      </div>

      <table style={{ width:'100%', borderCollapse:'collapse', border:'2px solid #8a4221' }}>
        <thead>
          <tr>
            <th style={th}>Crew / Día</th>
            {days.map(d => <th key={+d} style={th}>{human(d)}</th>)}
          </tr>
        </thead>
        <tbody>
          {usuarios.map(u=>(
            <tr key={u.id}>
              <td style={{...td, fontWeight:'bold', background:'#fff3c7'}}>{u.nombre}</td>
              {days.map(d=>{
                const ymd = fmtYMD(d);
                const cell = scheduleMap[u.id]?.[ymd] || { inicio:'', fin:'' };
                return (
                  <td key={ymd} style={td}>
                    <div style={{ display:'flex', gap:'0.35rem', justifyContent:'center' }}>
                      <input type="time" value={cell.inicio} onChange={e=>onTimeChange(u.id, ymd, 'inicio', e.target.value)} />
                      <input type="time" value={cell.fin}    onChange={e=>onTimeChange(u.id, ymd, 'fin', e.target.value)} />
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          {usuarios.length===0 && (
            <tr><td colSpan={1+days.length} style={td}>No hay usuarios cargados.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const th={ border:'1px solid #8a4221', padding:'0.5rem', background:'#FFF5E1', color:'#3D2314' };
const td={ border:'1px solid #8a4221', padding:'0.5rem', textAlign:'center' };
