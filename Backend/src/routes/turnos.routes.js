// src/routes/turnos.routes.js

const express = require('express');
const router  = express.Router();

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
  resumenTurnos
} = require('../controllers/turnos.controller');

const { generateScheduleFromNotebook } = require('../services/autoScheduler');

// 1️⃣ Registro uno o varios turnos
router.post('/', registrarTurno);

// 2️⃣ Obtengo todos los turnos
router.get('/', listarTurnos);

// — Static routes (must come before `/:id`) —

// Resumen entre dos fechas
// GET /turnos/resumen?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD
router.get('/resumen', resumenTurnos);

// Obtengo turnos por fecha específica
// GET /turnos/fecha/:fecha
router.get('/fecha/:fecha', turnosPorFecha);

// Genero el horario automáticamente
// POST /turnos/generar
router.post('/generar', generarHorario);

// Sugiero intercambios de turnos
// POST /turnos/intercambio
router.post('/intercambio', recomendarIntercambio);

// Envío por correo el calendario de turnos
// POST /turnos/enviar-correo
router.post('/enviar-correo', enviarCalendario);

// — end static routes —

// 3️⃣ Obtengo turnos de un usuario por ID
// GET /turnos/:id
router.get('/:id', turnosPorUsuario);

// 4️⃣ Actualizo un turno por ID
// PUT /turnos/:id
router.put('/:id', actualizarTurno);

// 5️⃣ Elimino un turno por ID
// DELETE /turnos/:id
router.delete('/:id', eliminarTurno);

// 6️⃣ Elimino todos los turnos
// DELETE /turnos
router.delete('/', eliminarTodos);

// POST /turnos/generar-python
router.post('/generar-python', async (req, res) => {
  try {
    const { fechaInicio } = req.body;
    if (!fechaInicio) return res.status(400).json({ error: 'falta fechaInicio' });

    const r = await generateScheduleFromNotebook(fechaInicio);
    res.json({
      mensaje: 'Generado con notebook',
      in: r.inPath,
      out: r.outPath,
      detalle: r.summary
    });
  } catch (e) {
    console.error('❌ generar-python:', e);
    res.status(500).json({ error: e.message || 'Error generando con notebook' }); // 👈 devuelve detalle
  }
});


module.exports = router;
