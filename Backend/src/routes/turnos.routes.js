// Importo express y creo el router
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
  eliminarTodos,
  enviarCalendario
} = require('../controllers/turnos.controller');

// Registro uno o varios turnos
router.post('/', registrarTurno);
// Obtengo todos los turnos
router.get('/', listarTurnos);
// Obtengo turnos de un usuario por ID
router.get('/:id', turnosPorUsuario);
// Obtengo turnos por fecha específica
router.get('/fecha/:fecha', turnosPorFecha);
// Actualizo un turno por ID
router.put('/:id', actualizarTurno);

// Genero el horario automáticamente
router.post('/generar', generarHorario);
// Sugiero intercambios de turnos
router.post('/intercambio', recomendarIntercambio);

// Elimino un turno por ID
router.delete('/:id', eliminarTurno);
// Elimino todos los turnos
router.delete('/', eliminarTodos);

// Envío por correo el calendario de turnos
router.post('/enviar-correo', enviarCalendario);

module.exports = router; // Exporto el router de turnos