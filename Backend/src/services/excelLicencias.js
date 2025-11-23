// src/services/excelLicencias.js
const Excel = require('exceljs');
const fs = require('fs');
const path = require('path');
const pool = require('../config/db');

// Usamos la misma ruta ABSOLUTA que ya tienes para Datos_v8.xlsx
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

function normalizeTipo(s) {
  return String(s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, ''); // quita tildes (CUMPLEANOS)
}

/**
 * Genera la hoja Licencias en Datos_v8.xlsx para el horizonte de 2 semanas
 * que parte en `mondayYMD` (string 'YYYY-MM-DD').
 *
 * Incluye:
 *  - Todas las LICENCIAS (tabla `licencias`, rango fecha_inicio–fecha_fin)
 *  - Todos los BENEFICIOS bloqueantes (tabla `beneficios`, tipo CUMPLEAÑOS/ADMIN/VACACIONES)
 *
 * Cada día bloqueado se traduce a una fila (ID, semana, dia) en la hoja "Licencias".
 */
async function syncLicenciasSheet(mondayYMD) {
  if (!IN_XLSX) {
    throw new Error('IN_XLSX/EXCEL_TRABAJADORES_PATH no configurado.');
  }

  const base = toDate(mondayYMD);
  if (Number.isNaN(base.getTime())) {
    throw new Error(`mondayYMD inválido: ${mondayYMD}`);
  }

  // Horizonte: 2 semanas (14 días)
  const horizonEnd = new Date(base);
  horizonEnd.setDate(horizonEnd.getDate() + 13); // 0..13

  // 1) Traer licencias
  const licQuery = `
    SELECT usuario_id, fecha_inicio, fecha_fin
    FROM licencias
    ORDER BY usuario_id, fecha_inicio
  `;
  const { rows: licRows } = await pool.query(licQuery);

  // 2) Traer beneficios
  const benQuery = `
    SELECT usuario_id, tipo, fecha
    FROM beneficios
    ORDER BY usuario_id, fecha
  `;
  const { rows: benRows } = await pool.query(benQuery);

  const triples = [];
  const usedKeys = new Set(); // para evitar duplicados (id, semana, dia)

  function addDayIfInHorizon(id, fechaDate) {
    const d = toDate(fechaDate);
    if (d < base || d > horizonEnd) return;
    const offset = diffDays(base, d); // 0..13
    const semana = offset < 7 ? 1 : 2;
    const dia = (offset % 7) + 1; // 1..7
    const key = `${id}|${semana}|${dia}`;
    if (!usedKeys.has(key)) {
      usedKeys.add(key);
      triples.push({ id, semana, dia });
    }
  }

  // 3) Expandir LICENCIAS a días dentro del horizonte
  for (const lic of licRows) {
    const id = Number(lic.usuario_id);
    if (!id) continue;

    const start = toDate(lic.fecha_inicio);
    const end = toDate(lic.fecha_fin);

    let cur = new Date(Math.max(start.getTime(), base.getTime()));
    const last = new Date(Math.min(end.getTime(), horizonEnd.getTime()));

    while (cur <= last) {
      addDayIfInHorizon(id, cur);
      cur.setDate(cur.getDate() + 1);
    }
  }

  // 4) Beneficios bloqueantes (cumpleaños, admin, vacaciones)
  const tiposBloqueantes = new Set([
    'CUMPLE',
    'CUMPLEANOS',
    'CUMPLEAÑOS',
    'ADMIN',
    'ADMINISTRATIVO',
    'VACACIONES',
  ]);

  for (const ben of benRows) {
    const id = Number(ben.usuario_id);
    if (!id) continue;
    const tipoNorm = normalizeTipo(ben.tipo);
    if (!tiposBloqueantes.has(tipoNorm)) continue;

    if (!ben.fecha) continue;
    addDayIfInHorizon(id, ben.fecha);
  }

  // 5) Escribir hoja Licencias en el Excel
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

  // Limpiar filas anteriores
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
    `[Licencias+Beneficios] Escritas ${triples.length} filas en hoja Licencias para lunes base ${mondayYMD}`
  );
}

module.exports = { syncLicenciasSheet };
