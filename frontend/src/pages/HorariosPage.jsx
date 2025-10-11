// src/pages/HorariosPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { generarPython, previewPython, commitPython } from '../api/turnos';
import { getUsuarios } from '../api/usuarios';

function parseYMDLocal(ymd){
  const [y,m,d]=String(ymd).split('-').map(Number);
  return new Date(y,(m||1)-1,d||1);
}
function addDaysLocal(d,n){
  const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  x.setDate(x.getDate()+n);
  return x;
}
function fmtYMD(d){
  const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function human(d){
  return d.toLocaleDateString();
}

export default function HorariosPage(){
  // lunes visible
  const [monday,setMonday]=useState(()=>{
    const today = new Date();
    const dow = today.getDay(); // 0=Dom, 1=Lun
    const diff = (dow===0 ? -6 : 1-dow);
    const mon  = addDaysLocal(today, diff);
    return fmtYMD(mon);
  });

  const [usuarios,setUsuarios]=useState([]);
  const [scheduleMap,setScheduleMap]=useState({});
  const [loading,setLoading]=useState(false);

  const days = useMemo(()=>{
    const b = parseYMDLocal(monday);
    return Array.from({length:7},(_,i)=> addDaysLocal(b,i));
  },[monday]);

  useEffect(()=>{
    (async()=>{
      try{
        const { data } = await getUsuarios();
        setUsuarios(data || []);
      }catch(e){
        console.error(e);
        alert('No se pudieron cargar los usuarios');
      }
    })();
  },[]);

  const ensureUserDay=(map,uid,ymd)=>{
    if(!map[uid]) map[uid]={};
    if(!map[uid][ymd]) map[uid][ymd]={ inicio:'', fin:'' };
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
    }finally{
      setLoading(false);
    }
  };

  const loadPreview=async()=>{
    try{
      const { data } = await previewPython(monday);
      const items = Array.isArray(data) ? data : (data?.items || []);
      if(!items.length){
        alert('No hay filas en el Excel (o no coinciden con esta semana).');
        return;
      }
      const next={};
      for(const it of items){
        const uid = Number(it.usuario_id);
        const fecha = String(it.fecha).slice(0,10);
        const inicio = String(it.hora_inicio||'').slice(0,5);
        const fin    = String(it.hora_fin||'').slice(0,5);
        if(!uid || !fecha || !inicio || !fin) continue;
        if(!next[uid]) next[uid] = {};
        next[uid][fecha] = { inicio, fin };
      }
      setScheduleMap(next);
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
            items.push({
              usuario_id:Number(uid),
              fecha:ymd,
              hora_inicio:cell.inicio,
              hora_fin:cell.fin,
            });
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
          <input type="date" value={monday} onChange={e=>setMonday(e.target.value)} />
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
            {days.map(d => (
              <th key={+d} style={th}>{human(d)}</th>
            ))}
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
