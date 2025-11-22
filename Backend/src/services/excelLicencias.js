// src/services/excelLicencias.js
const Excel = require('exceljs');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db.js');

// Usamos la misma ruta absoluta que ya tienes para la hoja "Trabajador"
const IN_XLSX =
  process.env.EXCEL_TRABAJADORES_PATH ||
  path.resolve(__dirname, '..', '..', 'python', 'Datos_v8.xlsx');

// Helpers de fecha
function toDate(x) {
  if (x instanceof Date) return x;
  if (typeof x === 'string') return new Date(`${x.slice(0, 10)}T00:00:00`);
  throw new Error(`Fecha inválida: ${x}`);
}
const diffDays = (a, b) =>
  Math.round((toDate(b) - toDate(a)) / (24 * 60 * 60 * 1000));

/**
 * Genera la hoja Licencias en Datos_v8.xlsx para el horizonte de 2 semanas
 * que parte en `mondayYMD` (string 'YYYY-MM-DD').
 *
 * Toma los datos desde la tabla `licencias`:
 *   - usuario_id
 *   - fecha_inicio
 *   - fecha_fin
 */
async function syncLicenciasSheet(mondayYMD) {
  if (!IN_XLSX) {
    throw new Error('IN_XLSX no configurado (ruta de Datos_v8.xlsx).');
  }

  const base = toDate(mondayYMD);
  if (Number.isNaN(base.getTime())) {
    throw new Error(`mondayYMD inválido: ${mondayYMD}`);
  }

  // Horizonte: 2 semanas (14 días)
  const horizonEnd = new Date(base);
  horizonEnd.setDate(horizonEnd.getDate() + 13);

  // 1) Traer licencias desde BD
  const { rows } = await pool.query(
    `SELECT usuario_id, fecha_inicio, fecha_fin
       FROM licencias
       ORDER BY usuario_id, fecha_inicio`
  );

  // 2) Expandir a triples (ID, semana, dia) dentro del horizonte
  const triples = [];

  for (const lic of rows) {
    const id = Number(lic.usuario_id);
    if (!id) continue;

    const start = toDate(lic.fecha_inicio);
    const end = toDate(lic.fecha_fin);

    // Acotar la licencia al horizonte de 2 semanas
    let cur = new Date(Math.max(start.getTime(), base.getTime()));
    const last = new Date(Math.min(end.getTime(), horizonEnd.getTime()));

    while (cur <= last) {
      const offset = diffDays(base, cur); // 0..13
      if (offset >= 0 && offset < 14) {
        const semana = offset < 7 ? 1 : 2;
        const dia = (offset % 7) + 1; // 1=lun ... 7=dom
        triples.push({ id, semana, dia });
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  // 3) Abrir Excel y escribir hoja Licencias
  const workbook = new Excel.Workbook();
  await workbook.xlsx.readFile(IN_XLSX);

  let sheet = workbook.getWorksheet('Licencias');
  if (!sheet) {
    sheet = workbook.addWorksheet('Licencias');
  }

  // Encabezados
  sheet.getCell('A1').value = 'ID';
  sheet.getCell('B1').value = 'semana';
  sheet.getCell('C1').value = 'dia';

  // Limpiar filas anteriores (desde la 2 hacia abajo)
  const maxRows = Math.max(triples.length + 5, 200);
  for (let r = 2; r <= maxRows; r++) {
    sheet.getCell(`A${r}`).value = null;
    sheet.getCell(`B${r}`).value = null;
    sheet.getCell(`C${r}`).value = null;
  }

  // Escribir nuevas filas
  let rowIdx = 2;
  for (const t of triples) {
    sheet.getCell(`A${rowIdx}`).value = t.id;
    sheet.getCell(`B${rowIdx}`).value = t.semana;
    sheet.getCell(`C${rowIdx}`).value = t.dia;
    rowIdx++;
  }

  const tmp = `${IN_XLSX}.tmp`;
  await workbook.xlsx.writeFile(tmp);
  await fs.promises.rename(tmp, IN_XLSX);

  console.log(
    `[Licencias] Escritas ${triples.length} filas en hoja Licencias para lunes base ${mondayYMD}`
  );
}

module.exports = { syncLicenciasSheet };
