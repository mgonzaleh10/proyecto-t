const express = require('express');
const router = express.Router();
const {
  registrarTurno,
  listarTurnos,
  turnosPorUsuario,
  generarHorario,
  turnosPorFecha,
  recomendarIntercambio
} = require('../controllers/turnos.controller');

// CRUD básico de turnos
router.post('/', registrarTurno);
router.post('/manual', registrarTurno);
router.get('/', listarTurnos);
router.get('/:id', turnosPorUsuario);
router.get('/fecha/:fecha', turnosPorFecha);

// Generación automática de la semana
router.post('/generar', generarHorario);

// Intercambio de turnos
router.post('/intercambio', recomendarIntercambio);

module.exports = router;