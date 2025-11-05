// src/services/excelDisponibilidades.js
const Excel = require('exceljs');
const fs = require('fs');
const pool = require('../config/db');

const EXCEL_PATH =
  process.env.EXCEL_TRABAJADORES_PATH ||
  process.env.INPUT_EXCEL_PATH; // ruta al Excel (define EXCEL_TRABAJADORES_PATH en .env)

/** 08:00->1, 08:30->2, 09:00->3, ..., 23:30->32 */
function bloqueDesdeHora(hhmm) {
  if (!hhmm) return null;
  const [h, m] = String(hhmm).split(':').map(Number);
  const dec = (h ?? 0) + (m ?? 0) / 60;
  let blk = Math.floor((dec - 8) * 2) + 1;    // floor para bordes exactos
  if (blk < 1) blk = 1;
  if (blk > 32) blk = 32;
  return blk;
}

/** Normaliza dia_semana a número 1..7 */
function diaToNum(d) {
  if (d == null) return null;
  const n = Number(d);
  if (!Number.isNaN(n) && n >= 1 && n <= 7) return n;
  const s = String(d).trim().toLowerCase();
  const map = {
    'lunes': 1, 'lun': 1, 'mon': 1,
    'martes': 2, 'mar': 2, 'tue': 2,
    'miércoles': 3, 'miercoles': 3, 'mié': 3, 'mie': 3, 'wed': 3,
    'jueves': 4, 'jue': 4, 'thu': 4,
    'viernes': 5, 'vie': 5, 'fri': 5,
    'sábado': 6, 'sabado': 6, 'sáb': 6, 'sab': 6, 'sat': 6,
    'domingo': 7, 'dom': 7, 'sun': 7
  };
  return map[s] || null;
}

/**
 * Sincroniza en "Trabajador":
 *   - H:I  -> "No Disponibilidad diaria" (ID, dia)
 *   - K:N  -> "No Disponibilidad diaria - puede entre" (ID, dia, inicio, término)
 * Reglas:
 *   * Sin registro -> H:I
 *   * Con registro -> K:N (solo si NO es jornada completa 1..32)
 */
async function syncDisponibilidadesSheet() {
  if (!EXCEL_PATH) {
    throw new Error('EXCEL_TRABAJADORES_PATH/INPUT_EXCEL_PATH no definido en .env');
  }

  // 1) Usuarios (YA NO excluimos ningún ID)
  const { rows: usuarios } = await pool.query(
    'SELECT id FROM usuarios ORDER BY id'
  );
  const userIds = usuarios.map(u => Number(u.id));

  // 2) Disponibilidades
  const { rows: disp } = await pool.query(
    `SELECT usuario_id, dia_semana,
            to_char(hora_inicio,'HH24:MI') AS hora_inicio,
            to_char(hora_fin,'HH24:MI')    AS hora_fin
     FROM disponibilidades
     ORDER BY usuario_id, dia_semana`
  );

  // 3) Agrupar por usuario/día (merge min inicio, max fin)
  const byUserDay = {};
  for (const d of disp) {
    const uid = Number(d.usuario_id);
    if (!userIds.includes(uid)) continue;
    const dayNum = diaToNum(d.dia_semana);
    if (!dayNum) continue;

    const inicio = d.hora_inicio?.slice(0, 5);
    const fin    = d.hora_fin?.slice(0, 5);
    if (!inicio || !fin) continue;

    const cur = byUserDay[uid]?.[dayNum];
    const merged = cur
      ? { inicio: (inicio < cur.inicio ? inicio : cur.inicio),
          fin:    (fin    > cur.fin    ? fin    : cur.fin) }
      : { inicio, fin };

    byUserDay[uid] = byUserDay[uid] || {};
    byUserDay[uid][dayNum] = merged;
  }

  // 4) Construir listas
  const noDisponibles = [];
  const parciales = [];

  for (const uid of userIds) {
    for (let dia = 1; dia <= 7; dia++) {
      const info = byUserDay[uid]?.[dia];
      if (!info) {
        noDisponibles.push({ id: uid, dia });
        continue;
      }
      const inicioBlk = bloqueDesdeHora(info.inicio);
      const finBlk    = bloqueDesdeHora(info.fin);

      // Excluir jornada completa
      if (inicioBlk <= 1 && finBlk >= 32) continue;

      if (!inicioBlk || !finBlk) {
        noDisponibles.push({ id: uid, dia });
        continue;
      }
      parciales.push({ id: uid, dia, inicio: inicioBlk, fin: finBlk });
    }
  }

  // 5) Abrir Excel y hoja
  const wb = new Excel.Workbook();
  await wb.xlsx.readFile(EXCEL_PATH);          // preserva estilos existentes
  const ws = wb.getWorksheet('Trabajador');
  if (!ws) throw new Error('No existe la hoja "Trabajador"');

  // 6) Limpiar SOLO valores desde fila 3 (sin tocar formatos/encabezados)
  for (let r = 3; r <= 2000; r++) {
    ws.getCell(`H${r}`).value = null;
    ws.getCell(`I${r}`).value = null;
    ws.getCell(`K${r}`).value = null;
    ws.getCell(`L${r}`).value = null;
    ws.getCell(`M${r}`).value = null;
    ws.getCell(`N${r}`).value = null;
  }

  // 7) Escribir listas (solo valores)
  let rowNI = 3;
  for (const n of noDisponibles) {
    ws.getCell(`H${rowNI}`).value = Number(n.id);
    ws.getCell(`I${rowNI}`).value = Number(n.dia);
    rowNI++;
  }

  let rowPE = 3;
  for (const p of parciales) {
    ws.getCell(`K${rowPE}`).value = Number(p.id);
    ws.getCell(`L${rowPE}`).value = Number(p.dia);
    ws.getCell(`M${rowPE}`).value = Number(p.inicio);
    ws.getCell(`N${rowPE}`).value = Number(p.fin);
    rowPE++;
  }

  // 8) Guardar por buffer (con estilos habilitados)
  const buffer = await wb.xlsx.writeBuffer({
    useStyles: true,
    useSharedStrings: true,
  });
  await fs.promises.writeFile(EXCEL_PATH, buffer);

  console.log(`🗓️ Excel disponibilidades sincronizado: ${parciales.length} parciales, ${noDisponibles.length} no disponibles`);
}

module.exports = { syncDisponibilidadesSheet };
