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
import { getBeneficios } from '../api/beneficios';
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
  const [baseDate, setBaseDate]     = useState(new Date().toISOString().slice(0,10));
  const [weekDates, setWeekDates]   = useState(getWeekDates(baseDate));
  const [crews, setCrews]           = useState([]);
  const [crewSel, setCrewSel]       = useState('');
  const [inputs, setInputs]         = useState({});
  const [cells, setCells]           = useState({});
  const [disps, setDisps]           = useState({});
  const [benefits, setBenefits]     = useState({});

  // Cargar crews
  useEffect(()=>{
    getUsuarios().then(r=>setCrews(r.data)).catch(console.error);
  },[]);

  // Cargar disponibilidades
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

  // Cargar beneficios
  useEffect(()=>{
    getBeneficios().then(r=>{
      const mp = {};
      r.data.forEach(b=>{
        const f = b.fecha.slice(0,10);
        mp[b.usuario_id] = mp[b.usuario_id]||{};
        mp[b.usuario_id][f] = b.tipo;
      });
      setBenefits(mp);
    }).catch(console.error);
  },[]);

  // Recalcular semana y limpiar inputs al cambiar baseDate
  useEffect(()=>{
    setWeekDates(getWeekDates(baseDate));
    setInputs({});
  },[baseDate]);

  // Cargar turnos + libres desde localStorage
  const loadData = useCallback(async ()=>{
    const all = [];
    for(const d of weekDates){
      const f = d.toISOString().slice(0,10);
      try{ const r = await getTurnosPorFecha(f); all.push(...r.data); }catch{}
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

  // Prefill inputs al cambiar crewSel
  useEffect(()=>{
    if(!crewSel){ setInputs({}); return; }
    const by = cells[crewSel]||{};
    const ni = {};
    weekDates.forEach((_,i)=>{
      const c = by[i];
      if(c) ni[i] = { inicio:c.inicio, fin:c.fin, free:c.free, id:c.id };
    });
    setInputs(ni);
  },[crewSel,cells,weekDates]);

  // Toggle Libre
  const toggleLibre = i => {
    setInputs(prev=>{
      const nxt = {...prev};
      const cur = nxt[i]||{};
      nxt[i] = { ...cur, free:!cur.free, inicio:'', fin:'' };
      return nxt;
    });
  };

  // Cambios en inputs de hora
  const handleInput = (i,field,val) => {
    setInputs(prev=>({
      ...prev,
      [i]: { ...(prev[i]||{}), [field]:val, free:false }
    }));
  };

  // Crear/Actualizar
  const handleSubmit = async ()=>{
    if(!crewSel){ alert('Selecciona primero un crew.'); return; }
    const store   = JSON.parse(localStorage.getItem(FREE_KEY)||'{}');
    const freeSet = new Set(store[crewSel]||[]);

    for(let i=0;i<7;i++){
      const dat = inputs[i]||{};
      const f   = weekDates[i].toISOString().slice(0,10);

      // Salto días con beneficio
      if(benefits[crewSel]?.[f]){
        freeSet.delete(f);
        continue;
      }

      // Libre
      if(dat.free){
        freeSet.add(f);
        if(dat.id) await eliminarTurno(dat.id);
        continue;
      }
      if(freeSet.has(f)) freeSet.delete(f);

      // Sin datos → eliminar existente
      if(!dat.inicio && !dat.fin){
        if(dat.id) await eliminarTurno(dat.id);
        continue;
      }

      // Validación de disponibilidad
      const avail = disps[crewSel]?.[DAY_LABELS[i].toLowerCase()];
      if(!avail ||
         parseTime(dat.inicio) < parseTime(avail.inicio) ||
         parseTime(dat.fin)    > parseTime(avail.fin)
      ){
        alert(`No disponible el ${DAY_LABELS[i]} (${avail?.inicio||'--'}–${avail?.fin||'--'})`);
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
      if(dat.id) await updateTurno(dat.id,payload);
      else      await crearTurno({ usuario_id:+crewSel, ...payload });
    }

    store[crewSel] = Array.from(freeSet);
    localStorage.setItem(FREE_KEY, JSON.stringify(store));

    await loadData();
    alert('Turnos procesados.');
  };

  // Limpiar todo
  const handleClearAll = async ()=>{
    if(!window.confirm('¿Borrar todos los turnos y libres?')) return;
    await eliminarTodosTurnos();
    localStorage.removeItem(FREE_KEY);
    setInputs({});
    await loadData();
    alert('Tabla limpiada.');
  };

  // Envío por correo
  const handleSend = async ()=>{
    if(!window.confirm('¿Enviar planilla?')) return;
    const tableEl = document.querySelector('.input-table');
    const canvas  = await html2canvas(tableEl);
    const img     = canvas.toDataURL('image/png');
    const dst     = crews.map(u=>u.correo);
    await enviarCalendario({
      destinatarios: dst,
      asunto: `Planilla ${baseDate}`,
      html: `<h2>Planilla de Turnos - ${baseDate}</h2><img src="${img}" style="max-width:100%;" />`
    });
    alert('Correo enviado.');
  };

  // Cálculo de horas trabajadas para mostrar al lado del nombre
  const horasTrabajadas = crewId => {
    const row = cells[crewId] || {};
    let total = 0;
    Object.values(row).forEach(c => {
      if(c && !c.free && c.inicio && c.fin){
        const mins = parseTime(c.fin) - parseTime(c.inicio);
        total += Math.max(0, mins/60 - 1);
      }
    });
    return +total.toFixed(1);
  };

  // Resumen Semanal
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
            <input
              type="date"
              value={baseDate}
              onChange={e=>setBaseDate(e.target.value)}
            />
          </label>
          <button onClick={handleSubmit} className="btn-save" style={{marginLeft:16}}>
            Crear/Actualizar
          </button>
        </div>
        <div>
          <button onClick={handleClearAll} style={{marginRight:16,background:'#c00',color:'#fff'}}>
            Limpiar tabla
          </button>
          <button onClick={handleSend} className="btn-email">
            Enviar por correo
          </button>
        </div>
      </div>

      {/* Tabla de inputs */}
      <table className="input-table">
        <thead>
          <tr>
            <th>Día</th>
            <th>Fecha</th>
            <th>Inicio</th>
            <th>Fin</th>
            <th>Libre</th>
          </tr>
        </thead>
        <tbody>
          {weekDates.map((d,i)=>{
            const f    = d.toISOString().slice(0,10);
            const tipo = benefits[crewSel]?.[f];

            // Día con beneficio
            if(tipo){
              return (
                <tr key={i}>
                  <td>{DAY_LABELS[i]}</td>
                  <td>{d.toLocaleDateString()}</td>
                  <td colSpan={3} className={`benefit-${tipo}`}>
                    {tipo}
                  </td>
                </tr>
              );
            }

            // Día normal
            return (
              <tr key={i}>
                <td>{DAY_LABELS[i]}</td>
                <td>{d.toLocaleDateString()}</td>
                <td>
                  <input
                    type="time"
                    disabled={!!inputs[i]?.free}
                    value={inputs[i]?.inicio||''}
                    onChange={e=>handleInput(i,'inicio',e.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="time"
                    disabled={!!inputs[i]?.free}
                    value={inputs[i]?.fin||''}
                    onChange={e=>handleInput(i,'fin',e.target.value)}
                  />
                </td>
                <td>
                  <button className="btn-free" onClick={()=>toggleLibre(i)}>
                    {inputs[i]?.free ? '✘' : 'Libre'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Resumen Semanal */}
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
              <td className="first-col">
                {c.nombre} ({horasTrabajadas(c.id)}/{c.horas_contrato})
              </td>
              {weekDates.map((_,i)=>{
                const f    = weekDates[i].toISOString().slice(0,10);
                const tipo = benefits[c.id]?.[f];
                if(tipo){
                  return (
                    <td key={i} className={`benefit-${tipo}`}>
                      {tipo}
                    </td>
                  );
                }
                const t     = cells[c.id]?.[i];
                const avail = disps[c.id]?.[DAY_LABELS[i].toLowerCase()];
                const assigned = t && !t.free && t.inicio && t.fin;
                const free     = t?.free;
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
              <td key={i}>
                {s.total} (A:{s.open} C:{s.close})
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}