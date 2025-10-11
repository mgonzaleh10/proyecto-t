// Backend/src/services/autoScheduler.js
// Ejecuta el notebook, lee Excel tipo "matriz 1..7" o "columnar", y entrega items listos.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const xlsx = require('xlsx');
const db = require('../config/db');

// Paths base
const ROOT = path.resolve(__dirname, '..', '..'); // Backend/
const PYDIR = path.join(ROOT, 'python');

const {
  PYTHON_BIN = 'python',
  NB_PATH: NB_PATH_ENV,
  NB_OUT_DIR: NB_OUT_DIR_ENV,
  IN_XLSX: IN_XLSX_ENV,
} = process.env;

// helpers
function firstExisting(cands){ for(const p of cands){ try{ if(p && fs.existsSync(p)) return p; }catch{} } return null; }
function ensureDir(p){ try{ fs.mkdirSync(p,{recursive:true}); }catch{} }
function toYMD(d){ const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function parseDMYtoYMD(s){ const [dd,mm,yyyy]=s.split('/').map(Number); if(!yyyy||!mm||!dd) return null; return `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`; }
function normalizeFecha(v){
  if(v==null) return null;
  if(typeof v==='number'){ const epoch=new Date(Math.round((v-25569)*86400*1000)); return toYMD(epoch); }
  const s=String(v).trim();
  if(s.includes('-')) return s.slice(0,10);
  if(s.includes('/')) return parseDMYtoYMD(s);
  return s;
}
// parse seguro local (evita UTC shift)
function parseYMDLocal(ymd){
  const [y,m,d]=String(ymd).split('-').map(Number);
  return new Date(y, (m||1)-1, d||1);
}
function addDaysLocal(d, n){
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate()+n);
  return x;
}
function normName(s){
  return String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/\s+/g,' ').trim();
}

// Localización de archivos
const RUNNER_PATH = firstExisting([ path.resolve(ROOT,'runner.py'), path.resolve(PYDIR,'runner.py') ]);
const NB_PATH     = firstExisting([ NB_PATH_ENV && path.resolve(ROOT,NB_PATH_ENV), path.resolve(PYDIR,'modelo-12.ipynb') ]);
const IN_XLSX     = firstExisting([ IN_XLSX_ENV && path.resolve(ROOT,IN_XLSX_ENV), path.resolve(PYDIR,'Datos_v8.xlsx') ]);
const NB_OUT_DIR  = (()=>{ const p = firstExisting([ NB_OUT_DIR_ENV&&path.resolve(ROOT,NB_OUT_DIR_ENV), path.resolve(PYDIR,'out'), PYDIR ]) || path.resolve(PYDIR,'out'); ensureDir(p); return p; })();

const OUTPUT_PREFIX='Carta_output';
const OUTPUT_EXT='.xlsx';
const CANDIDATE_DIRS=[NB_OUT_DIR, PYDIR].filter(Boolean);

function isOutputFile(f){ return f.startsWith(OUTPUT_PREFIX) && f.toLowerCase().endsWith(OUTPUT_EXT); }
function findLatestOutput(){
  let found=[];
  for(const dir of CANDIDATE_DIRS){
    if(!dir || !fs.existsSync(dir)) continue;
    const files=fs.readdirSync(dir).filter(isOutputFile).map(f=>({full:path.join(dir,f),mtime:fs.statSync(path.join(dir,f)).mtimeMs}));
    found=found.concat(files);
  }
  if(!found.length) return null;
  found.sort((a,b)=>b.mtime-a.mtime);
  return found[0].full;
}

// Ejecuta notebook con cwd=Backend/python (soporta rutas relativas del nb)
function runNotebook(){
  return new Promise((resolve,reject)=>{
    if(!RUNNER_PATH) return reject(new Error('runner.py no encontrado'));
    if(!NB_PATH)     return reject(new Error('modelo-12.ipynb no encontrado'));
    if(!IN_XLSX)     return reject(new Error('Datos_v8.xlsx no encontrado'));

    const outFile = path.join(NB_OUT_DIR, `${OUTPUT_PREFIX}.xlsx`);
    const args=[ RUNNER_PATH, '--nb', NB_PATH, '--in_xlsx', IN_XLSX, '--out_xlsx', outFile ];
    const WORKDIR = fs.existsSync(PYDIR) ? PYDIR : ROOT;

    const child=spawn(PYTHON_BIN,args,{ cwd: WORKDIR, stdio:['ignore','pipe','pipe'] });
    let outBuf='', errBuf='';
    child.stdout.on('data', d=> outBuf += d.toString());
    child.stderr.on('data', d=> errBuf += d.toString());
    child.on('error', reject);
    child.on('close', code=>{
      if(code===0) resolve({ out: outFile, logs: outBuf.trim() });
      else reject(new Error(`runner.py terminó con código ${code}${errBuf?`\nstderr:\n${errBuf}`:''}${outBuf?`\nstdout:\n${outBuf}`:''}`));
    });
  });
}

// --- Lectores de Excel ---

// 1) Lector "columnar": filas con fecha/hora_inicio/hora_fin/usuario_id o nombre
function readOutputItemsColumnar(outPath){
  const wb=xlsx.readFile(outPath);
  const sheet=wb.SheetNames[0];
  const ws=wb.Sheets[sheet];
  const rows=xlsx.utils.sheet_to_json(ws,{defval:''});
  const items = rows.map(r=>{
    const usuario_id = r.usuario_id || r.id_usuario || r.UsuarioId || r['usuario id'] || r['id usuario'] || null;
    const usuario_nombre = r.usuario_nombre || r.Empleado || r.nombre || r['usuario nombre'] || null;
    const fecha = normalizeFecha(r.fecha || r.Fecha || r.date);
    const hora_inicio = String(r.hora_inicio || r.inicio || r.HoraInicio || r['hora inicio'] || '').slice(0,5);
    const hora_fin    = String(r.hora_fin    || r.fin    || r.HoraFin    || r['hora fin']    || '').slice(0,5);
    return { usuario_id: usuario_id?Number(usuario_id):null, usuario_nombre: usuario_nombre?String(usuario_nombre).trim():null, fecha, hora_inicio, hora_fin };
  }).filter(it=>it.fecha && it.hora_inicio && it.hora_fin);
  return items;
}

// 2) Lector "matriz 1..7": A1="Trabajador"; B1..H1=1..7; celdas "HH:MM - HH:MM"
function readOutputItemsMatrix(outPath, mondayYMD){
  if(!mondayYMD) throw new Error('Se requiere fechaInicio (lunes) para interpretar la matriz 1..7 del Excel.');
  const wb=xlsx.readFile(outPath);
  const sheet=wb.SheetNames[0];
  const ws=wb.Sheets[sheet];
  const rows=xlsx.utils.sheet_to_json(ws,{defval:'', header:1}); // arrays

  if(!rows.length) return [];
  const hdr = rows[0].map(v=>String(v||'').trim());
  // Detectar la firma de matriz
  const isMatrix = (hdr[0].toLowerCase() === 'trabajador') &&
                   hdr.slice(1,8).every(v => ['1','2','3','4','5','6','7'].includes(v));
  if(!isMatrix) return null; // no es matriz

  const base = parseYMDLocal(mondayYMD);
  const items = [];

  for(let r=1; r<rows.length; r++){
    const row = rows[r];
    const nombre = String(row[0]||'').trim();
    if(!nombre) continue;

    for(let dayIdx=1; dayIdx<=7; dayIdx++){
      const cell = String(row[dayIdx]||'').trim();
      if(!cell) continue;

      const m = cell.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if(!m) continue;
      const inicio = m[1].padStart(5,'0').slice(0,5);
      const fin    = m[2].padStart(5,'0').slice(0,5);

      const d = addDaysLocal(base, dayIdx-1);
      const fecha = toYMD(d);

      items.push({
        usuario_id: null,
        usuario_nombre: nombre,
        fecha,
        hora_inicio: inicio,
        hora_fin: fin,
      });
    }
  }
  return items;
}

// Resolver usuario_id por nombre
async function attachUserIds(items){
  const need = items.some(it=>!it.usuario_id && it.usuario_nombre);
  if(!need) return items;
  const { rows } = await db.query('SELECT id, nombre FROM usuarios');
  const idx = new Map(rows.map(u=>[normName(u.nombre), u.id]));
  return items.map(it=>{
    if(!it.usuario_id && it.usuario_nombre){
      const id = idx.get(normName(it.usuario_nombre));
      if(id) return { ...it, usuario_id: id };
    }
    return it;
  });
}

// API principal
async function generateScheduleFromNotebook(_fechaInicio,{autoImport=false}={}) {
  const r=await runNotebook();
  let imported=0;
  if(autoImport){
    const latest=findLatestOutput() || r.out;
    if(latest && fs.existsSync(latest)){
      let items = readOutputItemsColumnar(latest);
      if(!items || !items.length) items = readOutputItemsMatrix(latest, _fechaInicio) || [];
      items = await attachUserIds(items);
      imported = await commitItemsToDb(items);
    }
  }
  return { out: r.out, imported, logs: r.logs };
}

async function previewFromPython({ fechaInicio } = {}) {
  const outPath=findLatestOutput();
  if(!outPath) throw new Error('No se encontró ningún Carta_output*.xlsx en ./python ni ./python/out');

  // Intento 1: formato columnar
  let items = readOutputItemsColumnar(outPath);

  // Intento 2: formato matriz 1..7 (requiere monday)
  if(!items || !items.length){
    items = readOutputItemsMatrix(outPath, fechaInicio) || [];
  }

  // Completar IDs
  items = await attachUserIds(items);

  // Filtrar por semana visible si dieron monday
  if(fechaInicio && /^\d{4}-\d{2}-\d{2}$/.test(fechaInicio)){
    const base = parseYMDLocal(fechaInicio);
    const week = new Set(Array.from({length:7},(_,i)=> toYMD(addDaysLocal(base,i))));
    items = items.filter(it => week.has(it.fecha));
  }

  return { outPath, items };
}

async function importOutputToDb(monday){
  const outPath=findLatestOutput();
  if(!outPath) throw new Error('No se encontró archivo de salida para importar');

  let items = readOutputItemsColumnar(outPath);
  if(!items || !items.length) items = readOutputItemsMatrix(outPath, monday) || [];
  items = await attachUserIds(items);

  if(monday && /^\d{4}-\d{2}-\d{2}$/.test(monday)){
    const base = parseYMDLocal(monday);
    const week = new Set(Array.from({length:7},(_,i)=> toYMD(addDaysLocal(base,i))));
    items = items.filter(it => week.has(it.fecha));
  }

  const inserted = await commitItemsToDb(items);
  return { outPath, inserted };
}

async function commitItemsToDb(items){
  if(!Array.isArray(items) || !items.length) return 0;
  let inserted=0;
  for(const it of items){
    const { usuario_id, fecha, hora_inicio, hora_fin } = it || {};
    if(!usuario_id || !fecha || !hora_inicio || !hora_fin) continue;
    await db.query(
      `INSERT INTO turnos (usuario_id, fecha, hora_inicio, hora_fin, creado_por, observaciones)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT DO NOTHING`,
      [usuario_id, fecha, hora_inicio, hora_fin, 19, 'importado de notebook']
    );
    inserted++;
  }
  return inserted;
}

module.exports = {
  generateScheduleFromNotebook,
  previewFromPython,
  importOutputToDb,
  commitItemsToDb,
};
