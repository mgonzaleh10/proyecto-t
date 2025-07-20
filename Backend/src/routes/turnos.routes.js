const express = require('express');
const router = express.Router();
const {
  registrarTurno,
  listarTurnos,
  turnosPorUsuario,
  turnosPorFecha,
  generarHorario,
  recomendarIntercambio,
  actualizarTurno,
  eliminarTurno,
  eliminarTodos
} = require('../controllers/turnos.controller');

// CRUD
router.post('/', registrarTurno);
router.get('/', listarTurnos);
router.get('/:id', turnosPorUsuario);
router.get('/fecha/:fecha', turnosPorFecha);
router.put('/:id', actualizarTurno);

// Generación automática
router.post('/generar', generarHorario);

// Intercambio
router.post('/intercambio', recomendarIntercambio);

// Borrado
router.delete('/:id', eliminarTurno);
router.delete('/', eliminarTodos);

module.exports = router;