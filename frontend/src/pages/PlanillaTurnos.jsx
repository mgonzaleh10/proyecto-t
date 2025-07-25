import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import html2canvas from 'html2canvas';
import {
  crearTurno,
  updateTurno,
  eliminarTurno,
  getTurnosPorFecha,
  eliminarTodosTurnos,
  enviarCalendario
} from '../api/turnos';
import { getUsuarios } from '../api/usuarios';
import { getDisponibilidades } from '../api/disponibilidades';
import './PlanillaTurnosManual.css';

const DAY_LABELS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const FREE_KEY   = 'freeMap';

function parseLocalDate(ymd) {
  const [y,m,d] = ymd.split('-').map(Number);
  return new Date(y, m-1, d);
}
function getWeekDates(base) {
  const date = typeof base==='string' ? parseLocalDate(base) : new Date(base);
  const diff = (date.getDay()+6)%7;
  const mon = new Date(date);
  mon.setDate(date.getDate()-diff);
  return Array.from({ length:7 }, (_,i)=>{
    const d = new Date(mon);
    d.setDate(mon.getDate()+i);
    return d;
  });
}
function parseTime(hm) {
  const [h,m] = hm.split(':').map(Number);
  return h*60 + m;
}

export default function PlanillaTurnos() {
  const [baseDate, setBaseDate] = useState(new Date().toISOString().slice(0,10));
  const [weekDates, setWeekDates] = useState(getWeekDates(baseDate));
  const [crews, setCrews] = useState([]);
  const [crewSel, setCrewSel] = useState('');
  const [inputs, setInputs] = useState({});
  const [cells, setCells] = useState({});
  const [disps, setDisps] = useState({});

  // Carga crews
  useEffect(()=>{
    getUsuarios().then(r=>setCrews(r.data)).catch(console.error);
  },[]);

  // Recálculo de la semana y limpieza de formulario superior
  useEffect(()=>{
    setWeekDates(getWeekDates(baseDate));
    setInputs({});
  },[baseDate]);

  // Cargo disponibilidades
  useEffect(()=>{
    getDisponibilidades().then(r=>{
      const mp = {};
      r.data.forEach(d=>{
        const day = d.dia_semana.toLowerCase();
        mp[d.usuario_id] = mp[d.usuario_id]||{};
        mp[d.usuario_id][day] = {
          inicio: d.hora_inicio.slice(0,5),
          fin:    d.hora_fin.slice(0,5)
        };
      });
      setDisps(mp);
    }).catch(console.error);
  },[]);

  // Cargo datos de turnos + libres de localStorage
  const loadData = useCallback(async ()=>{
    const all = [];
    for(const d of weekDates){
      const f = d.toISOString().slice(0,10);
      try { const r = await getTurnosPorFecha(f); all.push(...r.data); } catch {}
    }
    const m = {};
    all.forEach(t=>{
      const idx = weekDates.findIndex(dd=>dd.toISOString().slice(0,10)===t.fecha.slice(0,10));
      if(idx<0) return;
      m[t.usuario_id] = m[t.usuario_id]||{};
      m[t.usuario_id][idx] = {
        id: t.id,
        inicio: t.hora_inicio.slice(0,5),
        fin:    t.hora_fin.slice(0,5),
        free:   false
      };
    });
    const store = JSON.parse(localStorage.getItem(FREE_KEY)||'{}');
    Object.entries(store).forEach(([uid,dates])=>{
      const u = Number(uid);
      dates.forEach(ds=>{
        const idx = weekDates.findIndex(dd=>dd.toISOString().slice(0,10)===ds);
        if(idx>=0){
          m[u] = m[u]||{};
          m[u][idx] = { free:true };
        }
      });
    });
    setCells(m);
  },[weekDates]);
  useEffect(()=>{ loadData(); },[loadData]);

  // Prefill formulario al cambiar de crew
  useEffect(()=>{
    if(!crewSel){
      setInputs({});
      return;
    }
    const byCrew = cells[crewSel]||{};
    const newInputs = {};
    weekDates.forEach((d,i)=>{
      const c = byCrew[i];
      if(c){
        newInputs[i] = {
          inicio: c.inicio,
          fin:    c.fin,
          free:   c.free,
          id:     c.id
        };
      }
    });
    setInputs(newInputs);
  },[crewSel, cells, weekDates]);

  // Formulario superior: libre
  const toggleLibre = i => {
    setInputs(prev=>{
      const nxt = {...prev};
      const cur = nxt[i]||{};
      nxt[i] = { ...cur, free: !cur.free, inicio:'', fin:'' };
      return nxt;
    });
  };

  // Formulario superior: cambio hora
  const handleInput = (i,field,val) => {
    setInputs(prev=>({
      ...prev,
      [i]: { ...(prev[i]||{}), [field]: val, free:false }
    }));
  };

  // Procesa día por día sin abortar todo
  const handleSubmit = async () => {
    if(!crewSel){
      alert('Selecciona primero un crew.');
      return;
    }
    const nombre = crews.find(c=>c.id===+crewSel)?.nombre;
    for(let i=0;i<7;i++){
      const dat = inputs[i]||{};
      const f = weekDates[i].toISOString().slice(0,10);
      const dayName = DAY_LABELS[i];
      // Día libre
      if(dat.free){
        // almaceno en localStorage
        const store = JSON.parse(localStorage.getItem(FREE_KEY)||'{}');
        const s = new Set(store[crewSel]||[]);
        s.add(f);
        store[crewSel]=[...s];
        localStorage.setItem(FREE_KEY, JSON.stringify(store));
        if(dat.id) await eliminarTurno(dat.id);
        continue;
      }
      // Sin datos → ignoro
      if(!dat.inicio && !dat.fin){
        // Si existía turno, lo dejo intacto
        continue;
      }
      // Validar disponibilidad
      const dayKey = dayName.toLowerCase();
      const avail = disps[crewSel]?.[dayKey];
      if(!avail
         || parseTime(dat.inicio)<parseTime(avail.inicio)
         || parseTime(dat.fin)   >parseTime(avail.fin)
      ){
        alert(
          `${nombre} no disponible el ${dayName} `+
          `(${avail?.inicio||'--'}–${avail?.fin||'--'}).`
        );
        continue;
      }
      // Si borró horas pero tenía id, elimino
      if((!dat.inicio||!dat.fin) && dat.id){
        await eliminarTurno(dat.id);
        continue;
      }
      // Crear o actualizar
      const payload = {
        fecha:       f,
        hora_inicio: dat.inicio,
        hora_fin:    dat.fin,
        creado_por:  19,
        observaciones:''
      };
      if(dat.id){
        await updateTurno(dat.id, payload);
      } else {
        await crearTurno({ usuario_id:+crewSel, ...payload });
      }
    }
    await loadData();
    alert('Turnos procesados.');
  };

  const handleClearAll = async () => {
    if(!window.confirm('¿Borrar todos los turnos y libres?')) return;
    await eliminarTodosTurnos();
    localStorage.removeItem(FREE_KEY);
    setInputs({});
    await loadData();
    alert('Tabla limpiada.');
  };

  const handleSend = async () => {
    if(!window.confirm('¿Enviar planilla?')) return;
    const tableEl = document.querySelector('.planilla-table');
    const canvas  = await html2canvas(tableEl);
    const img     = canvas.toDataURL('image/png');
    const dst = crews.map(u=>u.correo);
    await enviarCalendario({
      destinatarios: dst,
      asunto: `Planilla ${baseDate}`,
      html: `<h2>Planilla de Turnos - ${baseDate}</h2><img src="${img}" style="max-width:100%;" />`
    });
    alert('Correo enviado.');
  };

  const summary = weekDates.map((_,i)=>{
    let tot=0, op=0, cl=0;
    crews.forEach(c=>{
      const t = cells[c.id]?.[i];
      if(t && !t.free && t.inicio && t.fin){
        tot++;
        if(t.fin==='23:30') cl++;
        const sm = parseTime(t.inicio);
        if(sm>=parseTime('08:00')&&sm<=parseTime('10:00')) op++;
      }
    });
    return { total:tot, open:op, close:cl };
  });

  return (
    <div className="planilla-container">
      <h2>Planilla de Turnos</h2>
      <div className="planilla-controls">
        <div>
          <Link to="/usuarios"><button>Ir a Crews</button></Link>
          <label style={{marginLeft:16}}>
            Crew:&nbsp;
            <select value={crewSel} onChange={e=>setCrewSel(e.target.value)}>
              <option value="">-- selecciona --</option>
              {crews.map(u=>(
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          </label>
          <label style={{marginLeft:16}}>
            Semana:&nbsp;
            <input type="date" value={baseDate}
                   onChange={e=>setBaseDate(e.target.value)}/>
          </label>
          <button onClick={handleSubmit} className="btn-save" style={{marginLeft:16}}>
            Crear/Actualizar
          </button>
        </div>
        <div>
          <button onClick={handleClearAll}
                  style={{marginRight:16,background:'#c00',color:'#fff'}}>
            Limpiar tabla
          </button>
          <button onClick={handleSend} className="btn-email">
            Enviar por correo
          </button>
        </div>
      </div>

      {/* Formulario de horario + día libre */}
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={th}>Día</th>
            <th style={th}>Fecha</th>
            <th style={th}>Inicio</th>
            <th style={th}>Fin</th>
            <th style={th}>Libre</th>
          </tr>
        </thead>
        <tbody>
          {weekDates.map((d,i)=>(
            <tr key={i}>
              <td style={tdLabel}>{DAY_LABELS[i]}</td>
              <td style={td}>{d.toLocaleDateString()}</td>
              <td style={td}>
                <input type="time"
                       disabled={!!inputs[i]?.free}
                       value={inputs[i]?.inicio||''}
                       onChange={e=>handleInput(i,'inicio',e.target.value)}/>
              </td>
              <td style={td}>
                <input type="time"
                       disabled={!!inputs[i]?.free}
                       value={inputs[i]?.fin||''}
                       onChange={e=>handleInput(i,'fin',e.target.value)}/>
              </td>
              <td style={td}>
                <button className="btn-free edit-center"
                        onClick={()=>toggleLibre(i)}>
                  {inputs[i]?.free?'✘':'Libre'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Resumen persistente (igual estilo que PlanillaTurnosManual) */}
      <h3 style={{marginTop:24}}>Resumen Semanal</h3>
      <table className="planilla-table">
        <thead>
          <tr>
            <th>Crew / Día</th>
            {weekDates.map((_,i)=>(
              <th key={i}>
                {DAY_LABELS[i]}<br/>{weekDates[i].toLocaleDateString()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {crews.map(c=>(
            <tr key={c.id}>
              <td className="first-col">{c.nombre}</td>
              {weekDates.map((_,i)=>{
                const t = cells[c.id]?.[i],
                      dayKey = DAY_LABELS[i].toLowerCase(),
                      avail  = disps[c.id]?.[dayKey],
                      assigned = t && !t.free && t.inicio && t.fin,
                      free     = t?.free;
                let cls = '';
                if(assigned) cls='assigned-cell';
                else if(free) cls='free-cell';
                return (
                  <td key={i} className={cls}>
                    {free
                      ? <span className="free-label">Libre</span>
                      : assigned
                        ? `${t.inicio}–${t.fin}`
                        : avail
                          ? <span className="disp-range">
                              Disp {avail.inicio}–{avail.fin}
                            </span>
                          : <span className="not-available">No disponible</span>
                    }
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Resumen</td>
            {summary.map((s,i)=>(
              <td key={i}>{s.total} (A:{s.open} C:{s.close})</td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

const tableStyle = { width:'100%', borderCollapse:'collapse', marginTop:'1rem' };
const th         = { border:'1px solid #ccc', padding:'0.5rem', background:'#f7f7f7' };
const td         = { border:'1px solid #ccc', padding:'0.5rem', textAlign:'center' };
const tdLabel    = { ...td, fontWeight:'bold', textAlign:'left' };