const express = require('express');
const router = express.Router();
const {
  crearDisponibilidad,
  listarDisponibilidades,
  eliminarDisponibilidad,
  eliminarTodas
} = require('../controllers/disponibilidades.controller');

// Creo una o varias disponibilidades
router.post('/', crearDisponibilidad);
// Obtengo todas las disponibilidades
router.get('/', listarDisponibilidades);

// Elimino la disponibilidad por su ID
router.delete('/:id', eliminarDisponibilidad);
// Elimino todas las disponibilidades
router.delete('/', eliminarTodas);

module.exports = router; // Exporto el router de disponibilidades