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

function firstExisting(cands){ for(const p of cands){ try{ if(p && fs.existsSync(p)) return p; }catch{} } return null; }
function ensureDir(p){ try{ fs.mkdirSync(p,{recursive:true}); }catch{} }
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
function parseYMDLocal(ymd){ const [y,m,d]=String(ymd).split('-').map(Number); return new Date(y,(m||1)-1,(d||1)); }
function addDaysLocal(d,n){ const x=new Date(d.getFullYear(),d.getMonth(),d.getDate()); x.setDate(x.getDate()+n); return x; }
function mondayOf(d){ const dow=d.getDay(); const diff=(dow===0?-6:1-dow); return addDaysLocal(d,diff); }
function normName(s){ return String(s||'').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu,'').replace(/\s+/g,' ').trim(); }

const RUNNER_PATH = firstExisting([ path.resolve(ROOT,'runner.py'), path.resolve(PYDIR,'runner.py') ]);
const NB_PATH     = firstExisting([ NB_PATH_ENV && path.resolve(ROOT,NB_PATH_ENV), path.resolve(PYDIR,'modelo-12.ipynb') ]);
const IN_XLSX     = firstExisting([ IN_XLSX_ENV && path.resolve(ROOT,IN_XLSX_ENV), path.resolve(PYDIR,'Datos_v8.xlsx') ]);
const NB_OUT_DIR  = (()=>{ const p=firstExisting([ NB_OUT_DIR_ENV&&path.resolve(ROOT,NB_OUT_DIR_ENV), path.resolve(PYDIR,'out'), PYDIR ]) || path.resolve(PYDIR,'out'); ensureDir(p); return p; })();

const OUTPUT_PREFIX='Carta_output';
const OUTPUT_EXT='.xlsx';

function isOutputFile(f){ return f.startsWith(OUTPUT_PREFIX) && f.toLowerCase().endsWith(OUTPUT_EXT); }
function listAllOutputs(){
  const dirs=[NB_OUT_DIR, PYDIR].filter(Boolean).filter(d=>fs.existsSync(d));
  const files=[];
  for(const dir of dirs){
    for(const f of fs.readdirSync(dir).filter(isOutputFile)){
      const full=path.join(dir,f);
      files.push({ full, mtime: fs.statSync(full).mtimeMs });
    }
  }
  files.sort((a,b)=>a.mtime-b.mtime);
  return files;
}
function findLatestOutput(){ const all=listAllOutputs(); return all.length ? all[all.length-1].full : null; }

// ---- Ejecutar notebook
function runNotebook(){
  return new Promise((resolve,reject)=>{
    if(!RUNNER_PATH) return reject(new Error('runner.py no encontrado'));
    if(!NB_PATH)     return reject(new Error('modelo-12.ipynb no encontrado'));
    if(!IN_XLSX)     return reject(new Error('Datos_v8.xlsx no encontrado'));

    const outFile = path.join(NB_OUT_DIR, `${OUTPUT_PREFIX}.xlsx`);
    const args=[ RUNNER_PATH, '--nb', NB_PATH, '--in_xlsx', IN_XLSX, '--out_xlsx', outFile ];
    const WORKDIR = fs.existsSync(PYDIR) ? PYDIR : ROOT;

    const child=spawn(PYTHON_BIN,args,{ cwd:WORKDIR, stdio:['ignore','pipe','pipe'] });
    let outBuf='', errBuf='';
    child.stdout.on('data',d=>outBuf+=d.toString());
    child.stderr.on('data',d=>errBuf+=d.toString());
    child.on('error',reject);
    child.on('close',code=>{
      if(code===0) resolve({ out: outFile, logs: outBuf.trim() });
      else reject(new Error(`runner.py terminó con código ${code}${errBuf?`\nstderr:\n${errBuf}`:''}${outBuf?`\nstdout:\n${outBuf}`:''}`));
    });
  });
}

// ---- Lectores
function readSheetColumnar(ws){
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

function readSheetMatrix(ws, baseMondayYMD){
  const rows = xlsx.utils.sheet_to_json(ws,{defval:'', header:1});
  if(!rows.length) return { ok:false, items:[] };

  const hdr = rows[0].map(v=>String(v||'').trim());
  const isMatrix = (hdr[0].toLowerCase()==='trabajador') &&
                   hdr.slice(1,8).every(v => ['1','2','3','4','5','6','7'].includes(String(v)));
  if(!isMatrix) return { ok:false, items:[] };

  if(!baseMondayYMD) throw new Error('Se requiere lunes base para interpretar la matriz.');
  const base = parseYMDLocal(baseMondayYMD);

  const items=[]; const seen=new Map(); // normName -> ordinal por FILA
  for(let r=1;r<rows.length;r++){
    const row=rows[r];
    const nombre=String(row[0]||'').trim();
    if(!nombre) continue;

    const key=normName(nombre);
    const ord=(seen.get(key)||0)+1; seen.set(key,ord);

    for(let dayIdx=1; dayIdx<=7; dayIdx++){
      const cell=String(row[dayIdx]||'').trim();
      if(!cell) continue;
      const m = cell.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if(!m) continue;

      const inicio=m[1].padStart(5,'0').slice(0,5);
      const fin   =m[2].padStart(5,'0').slice(0,5);
      const fecha = toYMD(addDaysLocal(base, dayIdx-1));
      items.push({ usuario_id:null, usuario_nombre:nombre, usuario_ordinal:ord, fecha, hora_inicio:inicio, hora_fin:fin });
    }
  }
  return { ok:true, items };
}

// Lee TODAS las hojas de un workbook.
// - Si hoja se llama "SemanaN", usa offset (N-1)*7 días sobre baseMonday.
// - Si no, usa índice de hoja como offset.
// - Primero intenta columnar; si no hay, intenta matriz.
function readWorkbookAllSheets(outPath, baseMondayYMD){
  const wb=xlsx.readFile(outPath);
  const itemsAll=[];
  wb.SheetNames.forEach((name, idx)=>{
    const ws = wb.Sheets[name];
    // 1) columnar
    const col = readSheetColumnar(ws);
    if(col.length){
      itemsAll.push(...col);
      return;
    }
    // 2) matriz con offset por hoja
    let offsetWeeks = 0;
    const m = String(name).toLowerCase().match(/semana\s*(\d+)/);
    if(m){ offsetWeeks = Math.max(0, (parseInt(m[1],10)||1) - 1); }
    else { offsetWeeks = idx; } // fallback: orden natural

    const base = baseMondayYMD ? toYMD(addDaysLocal(parseYMDLocal(baseMondayYMD), 7*offsetWeeks)) : null;
    const r = readSheetMatrix(ws, base);
    if(r.ok) itemsAll.push(...r.items);
  });
  return itemsAll;
}

// ---- IDs por nombre (maneja duplicados)
// Si item trae usuario_ordinal (matriz), asigna por ordinal fijo; si no, round-robin.
async function attachUserIds(items){
  const need = items.some(it=>!it.usuario_id && it.usuario_nombre);
  if(!need) return items;

  const { rows } = await db.query('SELECT id, nombre FROM usuarios');
  const nameToBuckets = new Map(); // norm -> { ids:[...], next:0 }
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
        }else{
          const id = bucket.ids[bucket.next % bucket.ids.length];
          bucket.next += 1;
          return { ...it, usuario_id: id };
        }
      }
    }
    return it;
  });
}

// ---- API
async function generateScheduleFromNotebook(fechaInicio,{autoImport=false}={}){
  const r = await runNotebook();
  let imported=0;
  if(autoImport){
    const items = await collectAllOutputs({ hintMonday: fechaInicio });
    imported = await commitItemsToDb(items);
  }
  return { out: r.out, imported, logs: r.logs };
}

// Une TODOS los Carta_output*.xlsx y TODAS sus hojas.
async function collectAllOutputs({ hintMonday } = {}){
  const files = listAllOutputs(); // por mtime asc
  const itemsAll=[];
  let rolling = hintMonday ? parseYMDLocal(hintMonday) : null;

  for(let i=0;i<files.length;i++){
    const fp = files[i].full;

    // si el libro tiene varias hojas "SemanaN", las interpretamos con baseMonday (rolling o hint)
    const base = rolling ? toYMD(rolling) : (hintMonday || null);

    const items = readWorkbookAllSheets(fp, base);
    if(items.length===0){
      // último recurso: tomar lunes del mtime del archivo
      const baseAlt = toYMD(mondayOf(new Date(files[i].mtime)));
      items.push(...readWorkbookAllSheets(fp, baseAlt));
    }
    itemsAll.push(...items);

    // para el siguiente archivo, desplazamos +4 semanas si detectamos hojas Semana1..Semana4
    const wb=xlsx.readFile(fp);
    const sNames=wb.SheetNames.map(n=>String(n).toLowerCase());
    const hasSemanas = sNames.some(n=>/semana\s*\d+/.test(n));
    if(rolling){
      rolling = addDaysLocal(rolling, hasSemanas ? 28 : 7);
    }else if(hintMonday){
      rolling = addDaysLocal(parseYMDLocal(hintMonday), hasSemanas ? 28 : 7);
    }
  }

  return attachUserIds(itemsAll);
}

async function previewFromPython({ fechaInicio } = {}){
  const items = await collectAllOutputs({ hintMonday: fechaInicio });
  return { outPath: null, items };
}

async function importOutputToDb(monday){
  const items = await collectAllOutputs({ hintMonday: monday });
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
      `INSERT INTO turnos (usuario_id, fecha, hora_inicio, hora_fin, observaciones)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT DO NOTHING`,
      [usuario_id, fecha, hora_inicio, hora_fin, 'importado de notebook']
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
