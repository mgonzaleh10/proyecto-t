// Backend/src/services/autoScheduler.js
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const ExcelJS = require('exceljs');
const pool = require('../config/db');

const PYTHON_BIN  = process.env.PYTHON_BIN  || 'python';
const NB_PATH     = path.resolve(process.env.NB_PATH    || './python/modelo-12.ipynb');
const NB_DIR      = path.dirname(NB_PATH);                       // carpeta original del notebook
const OUT_DIR     = path.resolve(process.env.NB_OUT_DIR || './python/out');   // backups/salidas
const RUNTIME_DIR = path.join(NB_DIR, 'runtime');                // carpeta temporal de ejecución

const TEMPLATE_FILE = path.join(NB_DIR, 'Datos_v8.xlsx');        // TU plantilla original
const RUNTIME_NB    = path.join(RUNTIME_DIR, 'modelo-12.ipynb'); // copia temporal
const RUNTIME_XLSX  = path.join(RUNTIME_DIR, 'Datos_v8.xlsx');   // copia temporal
const RUNTIME_OUT   = path.join(RUNTIME_DIR, 'Carta_output.xlsx'); // salida real del notebook

function ensureDir(p) { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); }
function ymd(d) { return d.toISOString().slice(0,10); }

/** Copia plantilla y notebook a runtime (no tocamos los originales) */
function prepareRuntime() {
  ensureDir(RUNTIME_DIR);
  ensureDir(OUT_DIR);

  // Copiar notebook si no existe o si el original es más nuevo
  try {
    const needCopyNB = !fs.existsSync(RUNTIME_NB) ||
      fs.statSync(NB_PATH).mtimeMs > fs.statSync(RUNTIME_NB).mtimeMs;
    if (needCopyNB) fs.copyFileSync(NB_PATH, RUNTIME_NB);
  } catch { fs.copyFileSync(NB_PATH, RUNTIME_NB); }

  // Copiar plantilla siempre
  fs.copyFileSync(TEMPLATE_FILE, RUNTIME_XLSX);
}

/** Rellena SOLO la hoja 'Trabajador' de la copia en runtime */
async function fillTrabajadorSheet(weekStartYMD) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(RUNTIME_XLSX);

  const ws = wb.getWorksheet('Trabajador');
  if (!ws) throw new Error(`La plantilla no contiene la hoja 'Trabajador'.`);

  // Limpio filas de datos desde la 2 (dejo headers)
  const last = ws.lastRow ? ws.lastRow.number : 1;
  if (last >= 2) ws.spliceRows(2, last - 1);

  // Traigo usuarios (ajusta si necesitas más campos)
  const { rows: users } = await pool.query(
    'SELECT id, nombre, puede_cerrar FROM usuarios ORDER BY id'
  );

  // Inserto filas respetando columnas de tu hoja (ver tu imagen)
  users.forEach(u => {
    const row = [];
    row[1]  = u.id;               // A: ID
    row[2]  = u.nombre;           // B: Nombre
    row[3]  = 'T30';              // C: Tipo (puedes mapear por horas_contrato si quieres)
    row[4]  = 0;                  // D: Cantidad dia (siempre 0 por ahora)
    row[5]  = u.puede_cerrar ? 1 : 0; // E: Habilitado para cierre (1/0)
    // F vacío
    // G-H-I bloque "No Disponibilidad diaria" -> lo dejamos sin tocar (tu plantilla ya tenía ejemplos)
    // K-L-M-N bloque "No Disponibilidad diaria - puede entre" -> lo dejamos vacío
    ws.addRow(row);
  });

  // Guarda la copia modificada SOLO en runtime
  await wb.xlsx.writeFile(RUNTIME_XLSX);

  // Backup de lo que vamos a usar en esta corrida (opcional)
  try {
    await wb.xlsx.writeFile(path.join(OUT_DIR, `Datos_v8_${weekStartYMD}.xlsx`));
  } catch {}
}

/** Ejecuta el notebook desde la carpeta runtime (cwd) */
async function runNotebook() {
  return new Promise((resolve, reject) => {
    const runnerPath = path.resolve(NB_DIR, 'runner.py'); // usamos tu runner.py original
    const args = [
      runnerPath,
      '--nb', RUNTIME_NB,
      '--in_xlsx', RUNTIME_XLSX,
      '--out_xlsx', path.join(OUT_DIR, 'out.xlsx') // solo informativo, Julia no lo usa
    ];

    const child = spawn(PYTHON_BIN, args, { cwd: RUNTIME_DIR });

    let stderr = '';
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('exit', (code) => {
      if (code === 0) return resolve(true);
      console.error('Papermill stderr:', stderr);
      reject(new Error(`Papermill exited with code ${code}`));
    });
  });
}

/** Importa Carta_output.xlsx desde runtime (o lanza error claro) */
async function importOutputExcel() {
  if (!fs.existsSync(RUNTIME_OUT)) {
    throw new Error(`No se encontró la salida del modelo: ${RUNTIME_OUT}`);
  }

  // Copia la salida a /python/out para dejar rastro
  try {
    const tag = new Date().toISOString().slice(0,10);
    fs.copyFileSync(RUNTIME_OUT, path.join(OUT_DIR, `Carta_output_${tag}.xlsx`));
  } catch {}

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(RUNTIME_OUT);

  // Usa hoja 'turnos' si existe; si no, la primera
  const sh = wb.getWorksheet('turnos') || wb.worksheets[0];
  if (!sh) throw new Error('El archivo de salida no tiene hoja con turnos');

  // Detecta cabeceras o usa columnas 1..4
  const header = [];
  sh.getRow(1).eachCell((cell, col) => header[col] = String(cell.value || '').trim().toLowerCase());
  const colUsuario = header.findIndex(h => ['usuario_id','usuario','id_usuario'].includes(h));
  const colFecha   = header.findIndex(h => ['fecha','day','date'].includes(h));
  const colInicio  = header.findIndex(h => ['hora_inicio','inicio','start'].includes(h));
  const colFin     = header.findIndex(h => ['hora_fin','fin','end'].includes(h));

  const shifts = [];
  sh.eachRow((row, i) => {
    if (i === 1) return;
    const usuario_id  = Number(row.getCell(colUsuario > 0 ? colUsuario : 1).value);
    const fecha       = String(row.getCell(colFecha   > 0 ? colFecha   : 2).value).slice(0,10);
    const hora_inicio = String(row.getCell(colInicio  > 0 ? colInicio  : 3).value).slice(0,5);
    const hora_fin    = String(row.getCell(colFin     > 0 ? colFin     : 4).value).slice(0,5);
    if (usuario_id && fecha && hora_inicio && hora_fin) {
      shifts.push({ usuario_id, fecha, hora_inicio, hora_fin });
    }
  });

  return shifts;
}

/** Inserta turnos (tu DB/controller ya validan disponibilidad y licencias) */
async function upsertGeneratedShifts(shifts, creado_por = 19) {
  for (const t of shifts) {
    try {
      await pool.query(
        `INSERT INTO turnos (usuario_id, fecha, hora_inicio, hora_fin, creado_por, observaciones)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [t.usuario_id, t.fecha, t.hora_inicio, t.hora_fin, creado_por, 'auto-py']
      );
    } catch (e) {
      console.error('Insert turno falló:', e.message);
    }
  }
  return { inserted: shifts.length };
}

/** Orquestador principal */
async function generateScheduleFromNotebook(weekStartYMD) {
  // 0) sanity
  if (!fs.existsSync(TEMPLATE_FILE)) {
    throw new Error(`No se encontró la plantilla original: ${TEMPLATE_FILE}`);
  }

  // 1) Preparo runtime seguro (no toca originales)
  prepareRuntime();

  // 2) Relleno SOLO la hoja Trabajador en la copia runtime
  await fillTrabajadorSheet(weekStartYMD);

  // 3) Ejecuto notebook en runtime
  await runNotebook();

  // 4) Leo salida y la inserto
  const shifts = await importOutputExcel();
  const result = await upsertGeneratedShifts(shifts);

  return {
    inPath: RUNTIME_XLSX,
    outPath: RUNTIME_OUT,
    summary: result
  };
}

module.exports = { generateScheduleFromNotebook };
