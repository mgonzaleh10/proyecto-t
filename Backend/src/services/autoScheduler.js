// Backend/src/services/autoScheduler.js
// - Ejecuta el notebook (cwd=Backend/python).
// - Lee Excel de salida en formato "matriz 1..7" o "columnar".
// - Para la "matriz", fija un mapeo ESTABLE nombre→usuario por ordinal de FILA,
//   para resolver correctamente duplicados (p. ej. dos "Agustin").
// - "Cargar preview" ahora une TODOS los archivos Carta_output*.xlsx que encuentre
//   y trata de inferir el lunes base de cada archivo (meta por archivo, _meta.json,
//   o lunes por mtime con ajuste a lunes); si no hay meta, usa fechaInicio del query
//   para el primero y suma semanas a los siguientes en orden por mtime.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const xlsx = require('xlsx');
const db = require('../config/db');

// ---- Paths base
const ROOT = path.resolve(__dirname, '..', '..'); // Backend/
const PYDIR = path.join(ROOT, 'python');

const {
  PYTHON_BIN = 'python',
  NB_PATH: NB_PATH_ENV,
  NB_OUT_DIR: NB_OUT_DIR_ENV,
  IN_XLSX: IN_XLSX_ENV,
} = process.env;

function firstExisting(cands){ for (const p of cands){ try { if (p && fs.existsSync(p)) return p; } catch {} } return null; }
function ensureDir(p){ try { fs.mkdirSync(p,{recursive:true}); } catch {} }
function toYMD(d){ const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }
function parseDMYtoYMD(s){ const [dd,mm,yyyy]=String(s).split('/').map(Number); if(!yyyy||!mm||!dd) return null; return `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`; }
function normalizeFecha(v){
  if(v==null) return null;
  if(typeof v==='number'){ const epoch=new Date(Math.round((v-25569)*86400*1000)); return toYMD(epoch); }
  const s=String(v).trim();
  if(s.includes('-')) return s.slice(0,10);
  if(s.includes('/')) return parseDMYtoYMD(s);
  return s;
}
// Fechas locales (evita UTC shift)
function parseYMDLocal(ymd){ const [y,m,d]=String(ymd).split('-').map(Number); return new Date(y,(m||1)-1,(d||1)); }
function addDaysLocal(d,n){ const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); x.setDate(x.getDate()+n); return x; }
function mondayOf(d){ const dow=d.getDay(); const diff=(dow===0?-6:1-dow); return addDaysLocal(d,diff); }
function normName(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/\s+/g,' ').trim(); }

const RUNNER_PATH = firstExisting([ path.resolve(ROOT,'runner.py'), path.resolve(PYDIR,'runner.py') ]);
const NB_PATH     = firstExisting([ NB_PATH_ENV && path.resolve(ROOT,NB_PATH_ENV), path.resolve(PYDIR,'modelo-12.ipynb') ]);
const IN_XLSX     = firstExisting([ IN_XLSX_ENV && path.resolve(ROOT,IN_XLSX_ENV), path.resolve(PYDIR,'Datos_v8.xlsx') ]);
const NB_OUT_DIR  = (()=>{ const p=firstExisting([ NB_OUT_DIR_ENV&&path.resolve(ROOT,NB_OUT_DIR_ENV), path.resolve(PYDIR,'out'), PYDIR ]) || path.resolve(PYDIR,'out'); ensureDir(p); return p; })();

const OUTPUT_PREFIX = 'Carta_output';
const OUTPUT_EXT = '.xlsx';

function isOutputFile(f){ return f.startsWith(OUTPUT_PREFIX) && f.toLowerCase().endsWith(OUTPUT_EXT); }
function listAllOutputs(){
  const dirs=[NB_OUT_DIR, PYDIR].filter(Boolean).filter(d=>fs.existsSync(d));
  const files=[];
  for(const dir of dirs){
    for(const f of fs.readdirSync(dir).filter(isOutputFile)){
      const full = path.join(dir,f);
      files.push({ full, mtime: fs.statSync(full).mtimeMs, dir });
    }
  }
  files.sort((a,b)=>a.mtime - b.mtime); // más antiguos primero
  return files;
}
function findLatestOutput(){
  const all=listAllOutputs();
  return all.length ? all[all.length-1].full : null;
}

function runNotebook(){
  return new Promise((resolve,reject)=>{
    if(!RUNNER_PATH) return reject(new Error('runner.py no encontrado'));
    if(!NB_PATH)     return reject(new Error('modelo-12.ipynb no encontrado'));
    if(!IN_XLSX)     return reject(new Error('Datos_v8.xlsx no encontrado'));

    const outFile = path.join(NB_OUT_DIR, `${OUTPUT_PREFIX}.xlsx`); // sobrescribe por diseño
    const args=[ RUNNER_PATH, '--nb', NB_PATH, '--in_xlsx', IN_XLSX, '--out_xlsx', outFile ];
    const WORKDIR = fs.existsSync(PYDIR) ? PYDIR : ROOT;

    const child = spawn(PYTHON_BIN, args, { cwd: WORKDIR, stdio:['ignore','pipe','pipe'] });
    let outBuf='', errBuf='';
    child.stdout.on('data', d=> outBuf+=d.toString());
    child.stderr.on('data', d=> errBuf+=d.toString());
    child.on('error', reject);
    child.on('close', code=>{
      if(code===0) resolve({ out: outFile, logs: outBuf.trim() });
      else reject(new Error(`runner.py terminó con código ${code}${errBuf?`\nstderr:\n${errBuf}`:''}${outBuf?`\nstdout:\n${outBuf}`:''}`));
    });
  });
}

// ---- Lectores de Excel
function readOutputItemsColumnar(outPath){
  const wb=xlsx.readFile(outPath); const ws=wb.Sheets[wb.SheetNames[0]];
  const rows=xlsx.utils.sheet_to_json(ws,{defval:''});
  return rows.map(r=>{
    const usuario_id = r.usuario_id || r.id_usuario || r.UsuarioId || r['usuario id'] || r['id usuario'] || null;
    const usuario_nombre = r.usuario_nombre || r.Empleado || r.nombre || r['usuario nombre'] || null;
    const fecha = normalizeFecha(r.fecha || r.Fecha || r.date);
    const hora_inicio = String(r.hora_inicio || r.inicio || r.HoraInicio || r['hora inicio'] || '').slice(0,5);
    const hora_fin    = String(r.hora_fin    || r.fin    || r.HoraFin    || r['hora fin']    || '').slice(0,5);
    return { usuario_id: usuario_id?Number(usuario_id):null, usuario_nombre: usuario_nombre?String(usuario_nombre).trim():null, fecha, hora_inicio, hora_fin };
  }).filter(it=>it.fecha && it.hora_inicio && it.hora_fin);
}

// Matriz A1="Trabajador", B1..H1=1..7; celdas "HH:MM - HH:MM"
// → Devuelve items con usuario_nombre + usuario_ordinal (ordinal de FILA por ese nombre)
function readOutputItemsMatrix(outPath, baseMondayYMD){
  const wb=xlsx.readFile(outPath); const ws=wb.Sheets[wb.SheetNames[0]];
  const rows=xlsx.utils.sheet_to_json(ws,{defval:'', header:1});

  if(!rows.length) return [];
  const hdr = rows[0].map(v => String(v||'').trim());
  const isMatrix = (hdr[0].toLowerCase()==='trabajador') &&
                   hdr.slice(1,8).every(v => ['1','2','3','4','5','6','7'].includes(String(v)));
  if(!isMatrix) return null;

  if(!baseMondayYMD) throw new Error('Se requiere el lunes base para interpretar la matriz (usar el meta o pasar fechaInicio).');

  const base = parseYMDLocal(baseMondayYMD);
  const items = [];
  // contador de ordinal por nombre para fijar mapping estable por FILA
  const seen = new Map(); // normName -> ordinal actual (1..n)

  for(let r=1; r<rows.length; r++){
    const row = rows[r];
    const nombre = String(row[0]||'').trim();
    if(!nombre) continue;

    const key = normName(nombre);
    const ord = (seen.get(key) || 0) + 1;
    seen.set(key, ord);

    for(let dayIdx=1; dayIdx<=7; dayIdx++){
      const cell = String(row[dayIdx]||'').trim();
      if(!cell) continue;
      const m = cell.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if(!m) continue;

      const inicio = m[1].padStart(5,'0').slice(0,5);
      const fin    = m[2].padStart(5,'0').slice(0,5);
      const fecha  = toYMD(addDaysLocal(base, dayIdx-1));

      items.push({ usuario_id:null, usuario_nombre:nombre, usuario_ordinal:ord, fecha, hora_inicio:inicio, hora_fin:fin });
    }
  }
  return items;
}

// Completar usuario_id por nombre; si hay duplicados, se usa usuario_ordinal para asignar fijo.
// Si no hay ordinal (formato columnar), se reparte round-robin.
async function attachUserIds(items){
  const need = items.some(it => !it.usuario_id && it.usuario_nombre);
  if(!need) return items;

  const { rows } = await db.query('SELECT id, nombre FROM usuarios');
  const nameToBuckets = new Map(); // norm -> { ids: [...], next: 0 }

  for(const u of rows){
    const key = normName(u.nombre);
    if(!nameToBuckets.has(key)) nameToBuckets.set(key, { ids: [], next: 0 });
    nameToBuckets.get(key).ids.push(u.id);
  }

  return items.map(it=>{
    if(!it.usuario_id && it.usuario_nombre){
      const bucket = nameToBuckets.get(normName(it.usuario_nombre));
      if(bucket && bucket.ids.length){
        if(it.usuario_ordinal){
          const id = bucket.ids[(it.usuario_ordinal - 1) % bucket.ids.length];
          return { ...it, usuario_id: id };
        } else {
          const id = bucket.ids[bucket.next % bucket.ids.length];
          bucket.next += 1;
          return { ...it, usuario_id: id };
        }
      }
    }
    return it;
  });
}

// ---- META por archivo
function metaPathFor(outPath){
  const { dir, name } = path.parse(outPath); // name sin extensión
  return path.join(dir, `${name}.meta.json`);
}
function writeMetaFor(outPath, baseMonday){
  try { fs.writeFileSync(metaPathFor(outPath), JSON.stringify({ base_monday: baseMonday || null }, null, 2), 'utf8'); } catch {}
}
function readMetaFor(outPath){
  try { return JSON.parse(fs.readFileSync(metaPathFor(outPath),'utf8')); } catch { return null; }
}

// ---- API
async function generateScheduleFromNotebook(fechaInicio, { autoImport=false } = {}){
  const r = await runNotebook();
  // Guarda meta para ese archivo recién generado
  writeMetaFor(r.out, fechaInicio || null);

  let imported = 0;
  if(autoImport){
    let items = await collectAllOutputs({ hintFirstMonday: fechaInicio });
    imported = await commitItemsToDb(items);
  }
  return { out: r.out, imported, logs: r.logs };
}

// Une TODOS los Carta_output*.xlsx en items[].
// Para interpretar matrices, intenta meta por archivo; si no existe, usa hintFirstMonday
// para el 1º archivo y suma 7 días por cada archivo subsiguiente; como último recurso,
// usa el lunes del mtime del archivo.
async function collectAllOutputs({ hintFirstMonday } = {}){
  const files = listAllOutputs(); // ordenados por mtime asc
  const itemsAll = [];
  let rollingMonday = hintFirstMonday ? parseYMDLocal(hintFirstMonday) : null;

  for(let i=0; i<files.length; i++){
    const fp = files[i].full;

    // 1) columnar
    let items = readOutputItemsColumnar(fp);

    if(!items || !items.length){
      // 2) matriz con meta por archivo
      let baseMondayYMD = null;
      const meta = readMetaFor(fp);
      if(meta && meta.base_monday) baseMondayYMD = meta.base_monday;

      // 3) si no hay meta, usar rollingMonday (y avanzar +7d para el siguiente)
      if(!baseMondayYMD && rollingMonday){
        baseMondayYMD = toYMD(rollingMonday);
      }

      // 4) último recurso: lunes de mtime
      if(!baseMondayYMD){
        const st = fs.statSync(fp);
        baseMondayYMD = toYMD(mondayOf(new Date(st.mtime)));
      }

      items = readOutputItemsMatrix(fp, baseMondayYMD) || [];
      // prepara rollingMonday para el siguiente
      if(rollingMonday){
        rollingMonday = addDaysLocal(rollingMonday, 7);
      } else if(hintFirstMonday){
        rollingMonday = addDaysLocal(parseYMDLocal(hintFirstMonday), 7);
      }
    }

    itemsAll.push(...items);
  }

  // Completar IDs (con soporte de duplicados por ordinal)
  return await attachUserIds(itemsAll);
}

async function previewFromPython({ fechaInicio } = {}){
  const items = await collectAllOutputs({ hintFirstMonday: fechaInicio });
  return { outPath: null, items };
}

async function importOutputToDb(monday){
  const items = await collectAllOutputs({ hintFirstMonday: monday });
  const inserted = await commitItemsToDb(items);
  return { outPath: null, inserted };
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
