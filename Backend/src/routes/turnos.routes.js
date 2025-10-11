// Backend/src/routes/turnos.routes.js
const { Router } = require('express');
const {
  registrarTurno,
  listarTurnos,
  turnosPorUsuario,
  turnosPorFecha,
  generarHorario,
  recomendarIntercambio,
  actualizarTurno,
  eliminarTurno,
  eliminarTodos,
  enviarCalendario,
  resumenTurnos,
} = require('../controllers/turnos.controller');

const {
  generateScheduleFromNotebook,
  previewFromPython,
  importOutputToDb,
  commitItemsToDb,
} = require('../services/autoScheduler');

const router = Router();

// === INTEGRACIÓN NOTEBOOK / EXCEL ===

// Ejecuta notebook (no importa a BD automáticamente)
router.post('/generar-python', async (req, res) => {
  try {
    const { fechaInicio } = req.body; // lunes mostrado en Horarios
    const r = await generateScheduleFromNotebook(fechaInicio, { autoImport: false });
    res.json({ out: r.out, imported: r.imported || 0 });
  } catch (e) {
    console.error('❌ generar-python:', e);
    res.status(500).json({ error: e.message || 'Error generando con notebook' });
  }
});

// Devuelve preview { outPath, items }, acepta ?fechaInicio=YYYY-MM-DD para filtrar semana
router.get('/preview-python', async (req, res) => {
  try {
    const { fechaInicio } = req.query || {};
    const r = await previewFromPython({ fechaInicio });
    res.json(r); // { outPath, items }
  } catch (e) {
    console.error('❌ preview-python:', e);
    res.status(500).json({ error: e.message || 'Error al leer Excel de salida' });
  }
});

// Importa directamente desde el último Excel a BD (opcional monday YYYY-MM-DD)
router.post('/import-python', async (req, res) => {
  try {
    const { monday } = req.body; // YYYY-MM-DD
    const r = await importOutputToDb(monday);
    res.json(r); // { outPath, inserted }
  } catch (e) {
    console.error('❌ import-python:', e);
    res.status(500).json({ error: e.message || 'Error importando Excel' });
  }
});

// Guarda en BD lo que envía HorariosPage tras editar el preview
router.post('/commit-python', async (req, res) => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items requerido (array no vacío)' });
    }
    const inserted = await commitItemsToDb(items);
    res.json({ inserted });
  } catch (e) {
    console.error('❌ commit-python:', e);
    res.status(500).json({ error: e.message || 'Error guardando items' });
  }
});

// === REST de turnos que ya tenías ===
router.post('/', registrarTurno);
router.get('/', listarTurnos);
router.get('/fecha/:fecha', turnosPorFecha);
router.get('/:id', turnosPorUsuario);
router.post('/generar', generarHorario);
router.post('/intercambio', recomendarIntercambio);
router.put('/:id', actualizarTurno);
router.delete('/:id', eliminarTurno);
router.delete('/', eliminarTodos);
router.post('/enviar-correo', enviarCalendario);
router.get('/resumen/listado', resumenTurnos);

module.exports = router;
