const express = require('express');
const router = express.Router();
const {
  registrarTurno,
  listarTurnos,
  turnosPorUsuario,
  turnosPorFecha,
  generarHorario,
  recomendarIntercambio,
  eliminarTurno,
  eliminarTodos,
  actualizarTurno
} = require('../controllers/turnos.controller');

// CRUD: crear y listar
router.post('/', registrarTurno);
router.get('/', listarTurnos);
router.get('/:id', turnosPorUsuario);
router.get('/fecha/:fecha', turnosPorFecha);

// Generación automática
router.post('/generar', generarHorario);

// Intercambio de turnos
router.post('/intercambio', recomendarIntercambio);

// Actualizar turno
router.put('/:id', actualizarTurno);

// Borrado
router.delete('/:id', eliminarTurno);
router.delete('/', eliminarTodos);

module.exports = router;