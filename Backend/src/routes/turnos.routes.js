const express = require('express');
const router = express.Router();
const {
  registrarTurno,
  listarTurnos,
  turnosPorUsuario,
  generarHorario,
  turnosPorFecha,
  recomendarIntercambio,
  eliminarTurno,
  eliminarTodos
} = require('../controllers/turnos.controller');

// CRUD
router.post('/', registrarTurno);
router.get('/', listarTurnos);
router.get('/:id', turnosPorUsuario);
router.get('/fecha/:fecha', turnosPorFecha);

// Generación automática
router.post('/generar', generarHorario);

// Intercambio
router.post('/intercambio', recomendarIntercambio);

// Borrado
router.delete('/:id', eliminarTurno);    // elimina turno por id
router.delete('/', eliminarTodos);        // elimina todos los turnos

module.exports = router;