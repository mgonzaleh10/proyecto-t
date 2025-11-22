import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import html2canvas from 'html2canvas';
import {
  crearTurno,
  updateTurno,
  eliminarTurno,
  getTurnosPorFecha,
  eliminarTodosTurnos,
  enviarCalendario,
  generarPython,
  previewPython,
  commitPython
} from '../api/turnos';
import { getUsuarios } from '../api/usuarios';
import { getDisponibilidades } from '../api/disponibilidades';
import { getBeneficios } from '../api/beneficios';
import { obtenerLicencias } from '../api/licencias';

import './PlanillaTurnosManual.css';

const DAY_LABELS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const FREE_KEY   = 'freeMap';

// NUEVO: clave para persistir el progreso del notebook
const PROGRESS_KEY = 'bk_notebook_progress';

function parseTime(hm){ const [h,m]=hm.split(':').map(Number); return h*60+m; }
function fmtYMD(d){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function parseLocalDate(ymd){ const [y,m,d]=ymd.split('-').map(Number); return new Date(y,m-1,d); }
function getWeekDates(base){
  const date=typeof base==='string'?parseLocalDate(base):new Date(base);
  const diff=(date.getDay()+6)%7;
  const mon=new Date(date); mon.setDate(date.getDate()-diff);
  return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d;});
}

export default function PlanillaTurnosManual(){
  const [baseDate,setBaseDate]=useState(fmtYMD(new Date()));
  const [weekDates,setWeekDates]=useState(getWeekDates(baseDate));
  const [crews,setCrews]=useState([]);
  const [cells,setCells]=useState({});
  const [editing,setEditing]=useState(false);
  const [disps,setDisps]=useState({});
  const [benefits,setBenefits]=useState({});
  const [leaves,setLeaves]=useState({});

  // === Progreso del notebook (persistente) ===
  const [pyProgress, setPyProgress] = useState({
    running: false,
    step: 0,
    total: 3,
    label: ''
  });

  // helper para actualizar estado + localStorage a la vez
  const updateProgress = (updater) => {
    setPyProgress(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
      } catch (e) {
        // ignore
      }
      return next;
    });
  };

  const pyPercent = pyProgress.running
    ? Math.round((pyProgress.step / pyProgress.total) * 100)
    : 0;

  // Al montar, recuperar progreso guardado (por si venimos de otra ruta)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PROGRESS_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && typeof saved.running === 'boolean') {
        setPyProgress(saved);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(()=>{ getUsuarios().then(r=>setCrews(r.data)).catch(console.error); },[]);
  useEffect(()=>{
    getDisponibilidades().then(r=>{
      const m={};
      r.data.forEach(d=>{
        const dia=d.dia_semana.toLowerCase();
        m[d.usuario_id]=m[d.usuario_id]||{};
        m[d.usuario_id][dia]={inicio:String(d.hora_inicio).slice(0,5),fin:String(d.hora_fin).slice(0,5)};
      });
      setDisps(m);
    }).catch(console.error);
  },[]);
  useEffect(()=>{
    getBeneficios().then(r=>{
      const m={};
      r.data.forEach(b=>{
        const f=String(b.fecha).slice(0,10);
        m[b.usuario_id]=m[b.usuario_id]||{};
        m[b.usuario_id][f]=b.tipo;
      });
      setBenefits(m);
    }).catch(console.error);
  },[]);
  useEffect(()=>{
    obtenerLicencias().then(list=>{
      const map={};
      list.forEach(l=>{
        const start=parseLocalDate(String(l.fecha_inicio).slice(0,10));
        const end=parseLocalDate(String(l.fecha_fin).slice(0,10));
        for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)){
          const ymd=fmtYMD(d);
          map[l.usuario_id]=map[l.usuario_id]||{};
          map[l.usuario_id][ymd]=true;
        }
      });
      setLeaves(map);
    }).catch(console.error);
  },[]);
  useEffect(()=>{ setWeekDates(getWeekDates(baseDate)); },[baseDate]);

  const loadData=useCallback(async ()=>{
    const all=[];
    for(const d of weekDates){
      const fecha=fmtYMD(d);
      try{ const r=await getTurnosPorFecha(fecha); all.push(...r.data);}catch{}
    }
    const m={};
    all.forEach(t=>{
      const tFecha=String(t.fecha).slice(0,10);
      const idx=weekDates.findIndex(dd=>fmtYMD(dd)===tFecha);
      if(idx>=0){
        m[t.usuario_id]=m[t.usuario_id]||{};
        m[t.usuario_id][idx]={id:t.id,inicio:String(t.hora_inicio).slice(0,5),fin:String(t.hora_fin).slice(0,5),free:false};
      }
    });
    const store=JSON.parse(localStorage.getItem(FREE_KEY)||'{}');
    Object.entries(store).forEach(([uid,fechas])=>{
      fechas.forEach(f=>{
        const idx=weekDates.findIndex(dd=>fmtYMD(dd)===f);
        if(idx>=0){ m[uid]=m[uid]||{}; m[uid][idx]={...(m[uid][idx]||{}),free:true}; }
      });
    });
    setCells(m);
  },[weekDates]);

  useEffect(()=>{ loadData(); },[loadData]);

  const toggleLibre=(crewId,dayIdx)=>{
    setCells(prev=>{
      const next={...prev,[crewId]:{...prev[crewId]}};
      next[crewId][dayIdx]={...(prev[crewId]?.[dayIdx]||{}),free:!prev[crewId]?.[dayIdx]?.free};
      const fecha=fmtYMD(weekDates[dayIdx]);
      const store=JSON.parse(localStorage.getItem(FREE_KEY)||'{}');
      const setFechas=new Set(store[crewId]||[]);
      if(next[crewId][dayIdx].free) setFechas.add(fecha); else setFechas.delete(fecha);
      store[crewId]=Array.from(setFechas);
      localStorage.setItem(FREE_KEY,JSON.stringify(store));
      return next;
    });
  };

  const handleCellChange=(crewId,dayIdx,field,val)=>{
    setCells(prev=>({
      ...prev,
      [crewId]:{
        ...prev[crewId],
        [dayIdx]:{...(prev[crewId]?.[dayIdx]||{}),[field]:val,free:false}
      }
    }));
  };

  const horasTrabajadas=(crewId)=>{
    const row=cells[crewId]||{}; let total=0;
    Object.values(row).forEach(c=>{
      if(c && !c.free && c.inicio && c.fin){
        const mins=parseTime(c.fin)-parseTime(c.inicio);
        total+=Math.max(0, mins/60 - 1);
      }
    });
    return +total.toFixed(1);
  };

  const saveAll=async ()=>{
    for(const crew of crews){
      const row=cells[crew.id]||{};
      for(let i=0;i<7;i++){
        const c=row[i]; const fecha=fmtYMD(weekDates[i]);
        if(leaves[crew.id]?.[fecha]) continue;
        if(benefits[crew.id]?.[fecha]) continue;
        if(c && !c.free && c.inicio && c.fin){
          const avail=disps[crew.id]?.[DAY_LABELS[i].toLowerCase()];
          if(!avail || parseTime(c.inicio)<parseTime(avail.inicio) || parseTime(c.fin)>parseTime(avail.fin)){
            alert(`No puede guardar: ${crew.nombre} el ${DAY_LABELS[i]} de ${c.inicio} a ${c.fin} (disp ${avail?.inicio||'--'}–${avail?.fin||'--'})`);
            return;
          }
        }
      }
    }
    for(const crew of crews){
      const row=cells[crew.id]||{};
      for(let i=0;i<7;i++){
        const c=row[i]; const fecha=fmtYMD(weekDates[i]);
        if(leaves[crew.id]?.[fecha]) continue;
        if(benefits[crew.id]?.[fecha]) continue;

        const payload={fecha, hora_inicio:c?.inicio, hora_fin:c?.fin, creado_por:19, observaciones:''};

        if((!c?.inicio || !c?.fin) && c?.id){ await eliminarTurno(c.id); continue; }
        if(c?.free){ if(c.id) await eliminarTurno(c.id); continue; }
        if(c?.inicio && c?.fin){ if(c.id) await updateTurno(c.id, payload); else await crearTurno({usuario_id:crew.id, ...payload}); }
      }
    }
    setEditing(false);
    await loadData();
    alert('Turnos procesados.');
  };

  const summary=weekDates.map((_,i)=>{
    let total=0, open=0, close=0;
    crews.forEach(c=>{
      const t=cells[c.id]?.[i];
      if(t && !t.free && t.inicio && t.fin){
        total++;
        if(t.fin==='23:30') close++;
        const sm=parseTime(t.inicio);
        if(sm>=parseTime('08:00')&&sm<=parseTime('10:00')) open++;
      }
    });
    return {total,open,close};
  });

  const handleSendEmail = async () => {
    if (!window.confirm('¿Enviar la foto de esta planilla por correo?')) return;

    try {
      const tableEl = document.querySelector('.planilla-table-wrap');
      if (!tableEl) {
        alert('No se encontró la tabla para capturar.');
        return;
      }

      // Guardar fondos actuales
      const screenEl = document.querySelector('.planilla-screen');
      const prevBodyBg   = document.body.style.backgroundColor;
      const prevScreenBg = screenEl ? screenEl.style.backgroundColor : '';

      // Fijar fondo sólido igual al del tema BK
      const bkBg = '#6a2e1f'; // mismo café de la app
      document.body.style.backgroundColor = bkBg;
      if (screenEl) screenEl.style.backgroundColor = bkBg;

      // Captura en alta resolución respetando colores del nodo
      const canvas = await html2canvas(tableEl, {
        backgroundColor: null,                        // usa los colores reales del wrap
        scale: window.devicePixelRatio > 1 ? 2 : 1.5, // un poco más de resolución
        useCORS: true,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
      });

      // Restaurar fondos originales
      document.body.style.backgroundColor = prevBodyBg;
      if (screenEl) screenEl.style.backgroundColor = prevScreenBg;

      const img = canvas.toDataURL('image/png');
      const destinatarios = crews.map(u => u.correo);

      await enviarCalendario({
        destinatarios,
        asunto: `Planilla Turnos ${baseDate}`,
        html: `<h2>Planilla de Turnos - Semana del ${baseDate}</h2>
               <img src="${img}" style="max-width:100%; border-radius:12px;" />`,
      });

      alert('Correos enviados correctamente.');
    } catch (e) {
      console.error(e);
      alert('Error al enviar correos.');
    }
  };


  const handleClearTable=async ()=>{
    if(!window.confirm('¿Borrar todos los turnos y libres asignados?')) return;
    await eliminarTodosTurnos();
    localStorage.removeItem(FREE_KEY);
    setEditing(false);
    await loadData();
    alert('Tabla limpiada.');
  };

  const handleToggleEdit=()=>{ if(editing){ loadData(); setEditing(false);} else{ setEditing(true);} };

  // === Generar notebook + importar automáticamente a BD y recargar planilla ===
  const handleGeneratePy=async ()=>{
    const monday=fmtYMD(weekDates[0]);
    if(!window.confirm(`¿Generar turnos con el notebook para la semana que inicia el ${monday} y guardarlos en la BD?`)) return;
    try{
      // Paso 1: ejecutar notebook
      updateProgress({ running:true, step:1, total:3, label:'Ejecutando notebook…' });
      await generarPython(monday);

      // Paso 2: leer Excel de salida
      updateProgress(prev => ({ ...prev, step:2, label:'Leyendo resultados generados…' }));
      const { data } = await previewPython(monday);
      const items = Array.isArray(data) ? data : (data?.items || []);
      if(!items.length){
        updateProgress({ running:false, step:0, total:3, label:'' });
        localStorage.removeItem(PROGRESS_KEY);
        alert('Notebook ejecutado, pero no se encontraron filas en los Excel de salida.');
        return;
      }

      // Paso 3: guardar en BD
      updateProgress(prev => ({ ...prev, step:3, label:'Guardando turnos en la base de datos…' }));
      const resp = await commitPython(items);
      const inserted = resp?.data?.inserted ?? 0;

      await loadData();
      setEditing(false);

      updateProgress({ running:false, step:3, total:3, label:'Completado' });
      localStorage.removeItem(PROGRESS_KEY);
      alert(`Generado con notebook.\nTurnos insertados: ${inserted}`);
    }catch(e){
      console.error(e);
      updateProgress({ running:false, step:0, total:3, label:'' });
      localStorage.removeItem(PROGRESS_KEY);
      alert(e?.response?.data?.error || e.message || 'Error generando e importando turnos.');
    }
  };

  /* ======== Asignar / Quitar días libres masivamente ======== */
  const handleToggleWeekFree = () => {
    const hasFreeThisWeek = crews.some(c => {
      const row = cells[c.id] || {};
      return weekDates.some((d, idx) => row[idx]?.free);
    });

    const weekDatesStr = weekDates.map(fmtYMD);

    if (!hasFreeThisWeek) {
      setCells(prev => {
        const next = { ...prev };
        const store = JSON.parse(localStorage.getItem(FREE_KEY) || '{}');

        crews.forEach(c => {
          const uid = c.id;
          const row = { ...(next[uid] || {}) };
          weekDates.forEach((d, idx) => {
            const fecha = weekDatesStr[idx];

            if (leaves[uid]?.[fecha]) return;
            if (benefits[uid]?.[fecha]) return;

            const current = row[idx];
            const hasTurno = current && current.inicio && current.fin && !current.free;
            if (hasTurno) return;

            row[idx] = { ...(current || {}), free: true };

            const setFechas = new Set(store[uid] || []);
            setFechas.add(fecha);
            store[uid] = Array.from(setFechas);
          });
          if (Object.keys(row).length > 0) {
            next[uid] = row;
          }
        });

        localStorage.setItem(FREE_KEY, JSON.stringify(store));
        return next;
      });
    } else {
      setCells(prev => {
        const next = { ...prev };

        crews.forEach(c => {
          const uid = c.id;
          const prevRow = prev[uid] || {};
          const row = { ...prevRow };

          weekDates.forEach((d, idx) => {
            const cell = row[idx];
            if (cell && cell.free) {
              const { free, ...rest } = cell;
              if (!rest.id && !rest.inicio && !rest.fin) {
                delete row[idx];
              } else {
                row[idx] = rest;
              }
            }
          });

          if (Object.keys(row).length === 0) {
            delete next[uid];
          } else {
            next[uid] = row;
          }
        });

        const store = JSON.parse(localStorage.getItem(FREE_KEY) || '{}');
        const weekSet = new Set(weekDatesStr);
        Object.entries(store).forEach(([uid, fechas]) => {
          store[uid] = (fechas || []).filter(f => !weekSet.has(f));
          if (store[uid].length === 0) delete store[uid];
        });
        localStorage.setItem(FREE_KEY, JSON.stringify(store));

        return next;
      });
    }
  };

  const renderViewCell = (c, avail) => {
    if(c?.free){
      return (
        <td className="tile tile--free">
          <span className="time-row">LIBRE</span>
        </td>
      );
    }
    if(c?.inicio && c?.fin){
      return (
        <td className="tile tile--shift">
          <span className="time-row">{c.inicio} — {c.fin}</span>
          {c?.id && (
            <button
              type="button"
              className="corner-id"
              title={`Turno ID: ${c.id}`}
            >
              i
            </button>
          )}
        </td>
      );
    }
    if(avail){
      return (
        <td className="tile tile--disp">
          <span className="time-row">Disp {avail.inicio} — {avail.fin}</span>
        </td>
      );
    }
    return (
      <td className="tile tile--na">
        <span className="label">No disponible</span>
      </td>
    );
  };

  const renderEditCell = (crewId, i, avail, t) => {
    if(t?.free){
      return (
        <td className="tile tile--free edit">
          <button className="mini ghost" onClick={()=>toggleLibre(crewId,i)}>Libre</button>
        </td>
      );
    }
    if(!avail){
      return (
        <td className="tile tile--na">
          <span className="label">No disponible</span>
        </td>
      );
    }
    return (
      <td className="tile tile--edit">
        <div className="edit-row">
          <input
            className="tinput"
            type="time"
            min={avail.inicio}
            max={avail.fin}
            value={t?.inicio||''}
            onChange={e=>handleCellChange(crewId,i,'inicio',e.target.value)}
          />
          <span className="dash">—</span>
          <input
            className="tinput"
            type="time"
            min={avail.inicio}
            max={avail.fin}
            value={t?.fin||''}
            onChange={e=>handleCellChange(crewId,i,'fin',e.target.value)}
          />
        </div>
        <button className="mini danger" title="Bloquear" onClick={()=>toggleLibre(crewId,i)}>⛔</button>
      </td>
    );
  };

  return (
    <div className="planilla-screen">
      <div className="poster-head">
        <h1>HORARIO LABORAL</h1>
        <p className="sub">Cobertura semanal</p>
      </div>

      <div className="toolbar">
        <div className="left">
          <Link to="/usuarios"><button className="bk-btn ghost">← Ir a Crews</button></Link>
          <label className="week-picker">
            <span>Semana:</span>
            <input type="date" value={baseDate} onChange={e=>setBaseDate(e.target.value)} />
          </label>
          <button className="bk-btn" onClick={handleToggleEdit}>{editing?'Cancelar':'Editar'}</button>
          {editing && <button className="bk-btn primary" onClick={saveAll}>Guardar Cambios</button>}
          <button
            className="bk-btn"
            onClick={handleGeneratePy}
            disabled={pyProgress.running}
          >
            {pyProgress.running ? 'Generando…' : 'Generar (Notebook)'}
          </button>
          <button className="bk-btn" onClick={handleToggleWeekFree}>
            Asignar / Quitar días libres
          </button>
        </div>
        <div className="right">
          <button className="bk-btn danger" onClick={handleClearTable}>Limpiar tabla</button>
          <button className="bk-btn info" onClick={handleSendEmail}>Enviar por correo</button>
        </div>
      </div>

      {/* Barra de progreso del notebook */}
      {pyProgress.running && (
        <div className="py-progress">
          <div className="py-progress-bar">
            <div
              className="py-progress-fill"
              style={{ width: `${pyPercent}%` }}
            />
          </div>
          <span className="py-progress-text">
            {pyProgress.label} ({pyProgress.step}/{pyProgress.total}) · {pyPercent}%
          </span>
        </div>
      )}

      <div className="planilla-table-wrap">
        <table className="planilla-table">
          <thead>
            <tr>
              <th className="col-emp">Empleado</th>
              {weekDates.map((d,i)=>(
                <th key={i}>
                  <div className="day-head">
                    <span className="day">{DAY_LABELS[i]}</span>
                    <span className="date">{d.toLocaleDateString()}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {crews.map(c=>(
              <tr key={c.id}>
                <td className="emp-cell">
                  <span className="emp-name">{c.nombre}</span>
                  <span className="emp-badge">{horasTrabajadas(c.id)}/{c.horas_contrato}</span>
                  <button
                    type="button"
                    className="corner-id"
                    title={`Usuario ID: ${c.id}`}
                  >
                    i
                  </button>
                </td>

                {weekDates.map((d,i)=>{
                  const fecha=fmtYMD(d);

                  if(leaves[c.id]?.[fecha]){
                    return (
                      <td key={i} className="tile tile--warn">
                        <span className="label">LICENCIA</span>
                      </td>
                    );
                  }

                  const tipo=benefits[c.id]?.[fecha];
                  if(tipo){
                    return (
                      <td key={i} className="tile tile--benefit">
                        <span className="label">{tipo}</span>
                      </td>
                    );
                  }

                  const t=cells[c.id]?.[i];
                  const avail=disps[c.id]?.[DAY_LABELS[i].toLowerCase()];

                  return editing
                    ? <React.Fragment key={i}>{renderEditCell(c.id,i,avail,t)}</React.Fragment>
                    : <React.Fragment key={i}>{renderViewCell(t,avail)}</React.Fragment>;
                })}
              </tr>
            ))}
          </tbody>

          <tfoot>
            <tr>
              <td className="emp-cell foot">Resumen</td>
              {summary.map((s,i)=>(
                <td key={i} className="tile tile--foot">
                  <span className="foot-line">{s.total}</span>
                  <span className="foot-mini">A:{s.open} • C:{s.close}</span>
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
