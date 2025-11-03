// src/services/excelSync.js
const Excel = require('exceljs');
const fs = require('fs');
const pool = require('../config/db'); // ✅ import correcto

// Ruta del Excel definida en .env
const EXCEL_PATH =
  process.env.EXCEL_TRABAJADORES_PATH ||
  process.env.INPUT_EXCEL_PATH; // fallback si existe

function tipoFromHoras(h) {
  const n = Number(h);
  if (n === 45) return 'T45';
  if (n === 30) return 'T30';
  if (n === 20) return 'T20';
  if (n === 16) return 'T16';
  return `T${n || ''}`;
}

/**
 * Sincroniza SOLO A2:E... en la hoja "Trabajador" con los usuarios de BD,
 */
async function syncTrabajadoresSheet() {
  if (!EXCEL_PATH) throw new Error('EXCEL_TRABAJADORES_PATH/INPUT_EXCEL_PATH no definido');

  // 1️⃣ Traer usuarios desde la BD
  const { rows: usuarios } = await pool.query(
    `SELECT id, nombre, horas_contrato, puede_cerrar 
     FROM usuarios 
     ORDER BY id`
  );

  // 2️⃣ Abrir workbook
  const wb = new Excel.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);

  const ws = wb.getWorksheet('Trabajador');
  if (!ws) {
    throw new Error('No existe la hoja "Trabajador" en el Excel');
  }

  // 3️⃣ Limpiar A2:E... (debajo de encabezados)
  const COLS = ['A', 'B', 'C', 'D', 'E'];
  const MAX_ROWS = Math.max(usuarios.length + 50, 200);
  for (let r = 2; r <= MAX_ROWS; r++) {
    for (const c of COLS) {
      ws.getCell(`${c}${r}`).value = null;
    }
  }

  // 4️⃣ Escribir datos actualizados
  let row = 2;
  for (const u of usuarios) {
    ws.getCell(`A${row}`).value = Number(u.id);
    ws.getCell(`B${row}`).value = u.nombre;
    ws.getCell(`C${row}`).value = tipoFromHoras(u.horas_contrato);
    ws.getCell(`D${row}`).value = 0; // puedes reemplazar con la lógica real
    ws.getCell(`E${row}`).value = u.puede_cerrar ? 1 : 0;
    row++;
  }

  // 5️⃣ Guardar Excel (forma segura)
  const tmp = `${EXCEL_PATH}.tmp`;
  await wb.xlsx.writeFile(tmp);
  await fs.promises.rename(tmp, EXCEL_PATH);

  console.log(`✅ Excel sincronizado correctamente (${usuarios.length} usuarios)`);
}

module.exports = { syncTrabajadoresSheet };
