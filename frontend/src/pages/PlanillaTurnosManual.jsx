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
import {
  recomendarIntercambio,
  confirmarIntercambio
} from '../api/intercambios.jsx';

import './PlanillaTurnosManual.css';

const DAY_LABELS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
const FREE_KEY   = 'freeMap';

// NUEVO: clave para persistir el progreso del notebook
const PROGRESS_KEY = 'bk_notebook_progress';

/* ===== Helpers de fechas / horas ===== */
function parseTime(hm){ const [h,m]=hm.split(':').map(Number); return h*60+m; }
function fmtYMD(d){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }
function parseLocalDate(ymd){ const [y,m,d]=ymd.split('-').map(Number); return new Date(y,m-1,d); }
function getWeekDates(base){
  const date=typeof base==='string'?parseLocalDate(base):new Date(base);
  const diff=(date.getDay()+6)%7;
  const mon=new Date(date); mon.setDate(date.getDate()-diff);
  return Array.from({length:7},(_,i)=>{ const d=new Date(mon); d.setDate(mon.getDate()+i); return d;});
}

function addDays(d, n){
  const nd = new Date(d);
  nd.setDate(nd.getDate()+n);
  return nd;
}
function diffDays(start, end){
  const ms = end - start;
  return Math.round(ms / (1000*60*60*24));
}
function fmtDMY(ymd){
  const [y,m,d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

/* === Helpers compartidos con Intercambio.jsx === */

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

export default function PlanillaTurnosManual(){
  const [baseDate,setBaseDate]=useState(fmtYMD(new Date()));
  const [weekDates,setWeekDates]=useState(getWeekDates(baseDate));
  const [crews,setCrews]=useState([]);
  const [cells,setCells]=useState({});
  const [editing,setEditing]=useState(false);
  const [disps,setDisps]=useState({});
  const [benefits,setBenefits]=useState({});
  const [leaves,setLeaves]=useState({});

  // Advertencias por usuario: { [usuarioId]: [{start, end}, ...] }
  const [warningMap, setWarningMap] = useState({});

  // === Progreso del notebook (persistente) ===
  const [pyProgress, setPyProgress] = useState({
    running: false,
    step: 0,
    total: 3,
    label: ''
  });

  // === Estado para intercambio de turnos directamente en la planilla ===
  // swapSource: { uid, dayIdx, turno, fecha, hora_inicio, hora_fin, turno_id }
  // swapCandidates: [{ ...swapBackend, uid, dayIdx }]
  const [swapMode, setSwapMode] = useState(false);
  const [swapSource, setSwapSource] = useState(null);
  const [swapCandidates, setSwapCandidates] = useState([]);

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

  /* ========= CARGA DE DATOS BASE ========= */

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

  /* ========= CÁLCULO DE ADVERTENCIAS (>6 días seguidos) ========= */

  const recomputeWarnings = useCallback(async () => {
    if (!weekDates.length || !crews.length) {
      setWarningMap({});
      return;
    }

    const monday = weekDates[0];
    const start  = addDays(monday, -7);   // lunes anterior
    const totalDays = 21;                 // semana anterior, actual y siguiente
    const dates = Array.from({ length: totalDays }, (_, i) => addDays(start, i));
    const ymdList = dates.map(fmtYMD);

    // turnos reales en BD por usuario/fecha
    const workMap = {};

    try {
      const responses = await Promise.all(
        ymdList.map(async (ymd) => {
          try {
            const r = await getTurnosPorFecha(ymd);
            return { ymd, data: r.data || [] };
          } catch {
            return { ymd, data: [] };
          }
        })
      );

      responses.forEach(({ ymd, data }) => {
        data.forEach(t => {
          const crewId = t.usuario_id;
          const fecha  = String(t.fecha).slice(0,10);
          if (fecha !== ymd) return;
          if (!t.hora_inicio || !t.hora_fin) return;
          workMap[crewId] = workMap[crewId] || {};
          workMap[crewId][fecha] = true;
        });
      });

      // Aplicar LIBRES manuales del localStorage
      const store = JSON.parse(localStorage.getItem(FREE_KEY) || '{}');
      Object.entries(store).forEach(([uidStr, fechas]) => {
        const uid = Number(uidStr);
        fechas.forEach(f => {
          if (!ymdList.includes(f)) return;
          workMap[uid] = workMap[uid] || {};
          workMap[uid][f] = false; // día libre rompe racha
        });
      });

      // Aplicar licencias y beneficios (no cuentan como trabajo)
      crews.forEach(c => {
        const uid = c.id;
        ymdList.forEach(f => {
          if (leaves[uid]?.[f] || benefits[uid]?.[f]) {
            if (workMap[uid]) workMap[uid][f] = false;
          }
        });
      });

      const weekStart = fmtYMD(weekDates[0]);
      const weekEnd   = fmtYMD(weekDates[6]);

      const result = {};

      crews.forEach(c => {
        const uid = c.id;
        let ranges = [];
        let runStart = null;
        let prevDate = null;

        dates.forEach((d, idx) => {
          const ymd = ymdList[idx];
          const isWork = !!workMap[uid]?.[ymd];

          if (isWork) {
            if (runStart === null) {
              runStart = ymd;
            }
          } else {
            if (runStart !== null) {
              const startY = runStart;
              const endY   = fmtYMD(prevDate);
              const len    = diffDays(parseLocalDate(startY), parseLocalDate(endY)) + 1;
              if (len > 6) ranges.push({ start: startY, end: endY });
              runStart = null;
            }
          }
          prevDate = d;
        });

        if (runStart !== null) {
          const startY = runStart;
          const endY   = fmtYMD(dates[dates.length - 1]);
          const len    = diffDays(parseLocalDate(startY), parseLocalDate(endY)) + 1;
          if (len > 6) ranges.push({ start: startY, end: endY });
        }

        const overlapped = ranges.filter(r => !(r.end < weekStart || r.start > weekEnd));
        if (overlapped.length) {
          result[uid] = overlapped;
        }
      });

      setWarningMap(result);
    } catch (e) {
      console.error('Error calculando advertencias:', e);
      setWarningMap({});
    }
  }, [weekDates, crews, benefits, leaves]);

  useEffect(() => {
    recomputeWarnings();
  }, [recomputeWarnings]);

  /* ========= LIBRES / EDICIÓN ========= */

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

    // Recalcular advertencias al marcar/quitar libre
    recomputeWarnings();
  };

  const handleCellChange=(crewId,dayIdx,field,val)=>{
    setCells(prev=>({
      ...prev,
      [crewId]:{
        ...prev[crewId],
        [dayIdx]:{...(prev[crewId]?.[dayIdx]||{}),[field]:val,free:false}
      }
    }));
    // Aquí NO recalculamos aún; se hará al guardar (saveAll)
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
    // Validación contra disponibilidades
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
    // Persistencia
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
    await recomputeWarnings();   // recalcular advertencias tras guardar
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

  /* ========= ENVÍO DE CORREO ========= */

  const handleSendEmail = async () => {
    if (!window.confirm('¿Enviar la foto de esta planilla por correo?')) return;

    try {
      const tableEl = document.querySelector('.planilla-table-wrap');
      if (!tableEl) {
        alert('No se encontró la tabla para capturar.');
        return;
      }

      const screenEl = document.querySelector('.planilla-screen');
      const prevBodyBg   = document.body.style.backgroundColor;
      const prevScreenBg = screenEl ? screenEl.style.backgroundColor : '';

      const bkBg = '#6a2e1f';
      document.body.style.backgroundColor = bkBg;
      if (screenEl) screenEl.style.backgroundColor = bkBg;

      const canvas = await html2canvas(tableEl, {
        backgroundColor: null,
        scale: window.devicePixelRatio > 1 ? 2 : 1.5,
        useCORS: true,
        scrollX: -window.scrollX,
        scrollY: -window.scrollY,
      });

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
    await recomputeWarnings();
    alert('Tabla limpiada.');
  };

  const handleToggleEdit=()=>{
    if(editing){
      loadData();
      setEditing(false);
    } else{
      // si entramos a editar, apagamos intercambio
      setSwapMode(false);
      setSwapSource(null);
      setSwapCandidates([]);
      setEditing(true);
    }
  };

  /* ========= NOTEBOOK PY ========= */

  const handleGeneratePy=async ()=>{
    const monday=fmtYMD(weekDates[0]);
    if(!window.confirm(`¿Generar turnos con el notebook para la semana que inicia el ${monday} y guardarlos en la BD?`)) return;
    try{
      updateProgress({ running:true, step:1, total:3, label:'Ejecutando notebook…' });
      await generarPython(monday);

      updateProgress(prev => ({ ...prev, step:2, label:'Leyendo resultados generados…' }));
      const { data } = await previewPython(monday);
      const items = Array.isArray(data) ? data : (data?.items || []);
      if(!items.length){
        updateProgress({ running:false, step:0, total:3, label:'' });
        localStorage.removeItem(PROGRESS_KEY);
        alert('Notebook ejecutado, pero no se encontraron filas en los Excel de salida.');
        return;
      }

      updateProgress(prev => ({ ...prev, step:3, label:'Guardando turnos en la base de datos…' }));
      const resp = await commitPython(items);
      const inserted = resp?.data?.inserted ?? 0;

      await loadData();
      setEditing(false);
      await recomputeWarnings();

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

    // Recalcular advertencias al asignar / quitar días libres en masa
    recomputeWarnings();
  };

  /* ====== INTERCAMBIO DIRECTO EN LA PLANILLA ====== */

  const resetSwapState = () => {
    setSwapMode(false);
    setSwapSource(null);
    setSwapCandidates([]);
  };

  const handleToggleSwapMode = () => {
    if (swapMode) {
      resetSwapState();
    } else {
      if (editing) {
        alert('Termina o cancela la edición antes de usar el intercambio.');
        return;
      }
      setSwapMode(true);
      setSwapSource(null);
      setSwapCandidates([]);
    }
  };

  const handleConfirmSwap = async (source, cand) => {
    if (!source || !cand) return;
    if (cand.tipo !== 'swap') return;

    const uidA = source.uid;
    const uidB = cand.usuario_id;
    const fechaA = source.fecha;
    const inicioA = source.turno.inicio;
    const finA = source.turno.fin;

    const crewA = crews.find(c => c.id === uidA);
    const crewB = crews.find(c => c.id === uidB);

    const tB = getTurnoB(cand);

    if (!tB.turnoDestinoId) {
      alert('No se pudo identificar el turno destino para el intercambio.');
      return;
    }

    const msg =
      'Confirmar INTERCAMBIO real:\n\n' +
      `${crewA?.nombre || `ID ${uidA}`} cede su turno ${fechaA} ${inicioA}-${finA}\n` +
      `${crewB?.nombre || `ID ${uidB}`} cede su turno ${tB.fechaB} ${tB.inicioB}-${tB.finB}\n\n` +
      '¿Deseas confirmar?';

    if (!window.confirm(msg)) return;

    try {
      const payload = {
        tipo: 'swap',
        turno_origen_id: source.turno_id ? Number(source.turno_id) : null,
        usuario_solicitante: uidA,
        usuario_candidato: uidB,
        fecha: fechaA,
        hora_inicio: inicioA,
        hora_fin: finA,
        turno_destino_id: tB.turnoDestinoId
      };

      await confirmarIntercambio(payload);

      // Sincronizar freeMap como en Intercambio.jsx
      try {
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

        if (tB.fechaB && tB.fechaB !== fechaA) {
          // Quitar libres donde ahora hay turno
          removeFree(uidA, tB.fechaB);
          removeFree(uidB, fechaA);

          // Añadir libres donde ahora NO hay turno
          addFree(uidA, fechaA);
          addFree(uidB, tB.fechaB);
        }

        localStorage.setItem(FREE_KEY, JSON.stringify(store));
      } catch (e) {
        console.warn('No se pudo actualizar freeMap tras el swap:', e);
      }

      await loadData();
      await recomputeWarnings();

      resetSwapState();
      alert('Intercambio de turnos realizado correctamente.');
    } catch (e) {
      console.error(e);
      alert('Error al realizar el intercambio de turnos.');
    }
  };

  // Devuelve clase extra para cada celda según el estado del modo intercambio
  const getSwapCellClass = (crewId, dayIdx, hasShift) => {
  if (!swapMode) return '';

  // Fase 1: sin origen aún → sólo marcamos los turnos clicables
  if (!swapSource) {
    return hasShift ? ' tile--clickable' : ' tile--disabled';
  }

  // Turno origen A seleccionado
  if (swapSource.uid === crewId && swapSource.dayIdx === dayIdx) {
    return ' tile--source';
  }

  // Turnos candidatos B
  const isCandidate = swapCandidates.some(
    cand => cand.uid === crewId && cand.dayIdx === dayIdx
  );
  if (isCandidate) {
    return ' tile--candidate';
  }

  // Resto de celdas se apagan
  return ' tile--disabled';
};


  /* ========= RENDER CELDAS ========= */

const renderViewCell = (c, avail, crewId, dayIdx) => {
  const hasShift = !!(c && !c.free && c.inicio && c.fin);
  const swapCls = getSwapCellClass(crewId, dayIdx, hasShift);

  const handleClick = async () => {
    if (!swapMode || !hasShift) return;

    // 🔹 Si ya hay origen y vuelvo a hacer click en el mismo turno A → deseleccionar
    if (
      swapSource &&
      swapSource.uid === crewId &&
      swapSource.dayIdx === dayIdx
    ) {
      setSwapSource(null);
      setSwapCandidates([]);
      return;
    }

    const fechaA = fmtYMD(weekDates[dayIdx]);

    // Primera selección: definimos origen y pedimos candidatos al backend
    if (!swapSource) {
      if (!c.id) {
        alert('Solo puedes intercambiar turnos que ya estén guardados en la base de datos.');
        return;
      }

      try {
        const payload = {
          usuario_id: crewId,
          turno_id: c.id,
          fecha: fechaA,
          hora_inicio: c.inicio,
          hora_fin: c.fin
        };

        const { data } = await recomendarIntercambio(payload);
        const swapsRaw = Array.isArray(data?.swaps) ? data.swaps : [];
        const swaps = swapsRaw.filter(r => r.tipo === 'swap');

        if (!swaps.length) {
          alert('No se encontraron candidatos de intercambio para este turno.');
          return;
        }

        const uiCandidates = [];
        swaps.forEach(r => {
          const tB = getTurnoB(r);
          const idxB = weekDates.findIndex(d => fmtYMD(d) === tB.fechaB);
          if (idxB < 0) return; // fuera de la semana visible
          uiCandidates.push({
            ...r,
            uid: r.usuario_id,
            dayIdx: idxB
          });
        });

        if (!uiCandidates.length) {
          alert('Los candidatos encontrados están fuera de la semana visible en la planilla.');
          return;
        }

        setSwapSource({
          uid: crewId,
          dayIdx,
          turno: c,
          fecha: fechaA,
          hora_inicio: c.inicio,
          hora_fin: c.fin,
          turno_id: c.id
        });
        setSwapCandidates(uiCandidates);
      } catch (e) {
        console.error(e);
        alert('No se pudieron obtener opciones de intercambio para este turno.');
      }
      return;
    }

    // Segunda selección: sólo se acepta si es candidato válido
    const cand = swapCandidates.find(
      cand => cand.uid === crewId && cand.dayIdx === dayIdx
    );
    if (!cand) return;

    await handleConfirmSwap(swapSource, cand);
  };

  if (c?.free) {
    return (
      <td className={`tile tile--free${swapCls}`}>
        <span className="time-row">LIBRE</span>
      </td>
    );
  }
  if (hasShift) {
    return (
      <td
        className={`tile tile--shift${swapCls}`}
        onClick={handleClick}
      >
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
  if (avail) {
    return (
      <td className={`tile tile--disp${swapCls}`}>
        <span className="time-row">Disp {avail.inicio} — {avail.fin}</span>
      </td>
    );
  }
  return (
    <td className={`tile tile--na${swapCls}`}>
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

  /* ========= RENDER PRINCIPAL ========= */

  return (
    <div className={`planilla-screen ${swapMode ? 'swap-active' : ''}`}>
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
          <button
            className={`bk-btn ${swapMode ? 'primary' : ''}`}
            onClick={handleToggleSwapMode}
            disabled={editing}
          >
            {swapMode ? 'Cancelar intercambio' : 'Intercambio'}
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
              {/* Columna extra sin encabezado visible */}
              <th className="warn-col" aria-label="Advertencias de días consecutivos" />
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
                    const swapCls = getSwapCellClass(c.id, i, false);
                    return (
                      <td key={i} className={`tile tile--warn${swapCls}`}>
                        <span className="label">LICENCIA</span>
                      </td>
                    );
                  }

                  const tipo=benefits[c.id]?.[fecha];
                  if(tipo){
                    const swapCls = getSwapCellClass(c.id, i, false);
                    return (
                      <td key={i} className={`tile tile--benefit${swapCls}`}>
                        <span className="label">{tipo}</span>
                      </td>
                    );
                  }

                  const t=cells[c.id]?.[i];
                  const avail=disps[c.id]?.[DAY_LABELS[i].toLowerCase()];

                  return editing
                    ? <React.Fragment key={i}>{renderEditCell(c.id,i,avail,t)}</React.Fragment>
                    : <React.Fragment key={i}>{renderViewCell(t,avail,c.id,i)}</React.Fragment>;
                })}

                {/* Celda de advertencias (sin encabezado visible) */}
                <td className="warn-cell">
                  {warningMap[c.id]?.length > 0 && (
                    <span
                      className="warn-icon"
                      title={
                        warningMap[c.id]
                          .map(r => `Más de 6 días consecutivos trabajados entre ${fmtDMY(r.start)} y ${fmtDMY(r.end)}`)
                          .join('\n')
                      }
                    >
                      !
                    </span>
                  )}
                </td>

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
              {/* Celda vacía para que el pie tenga el mismo número de columnas */}
              <td className="warn-cell foot" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
