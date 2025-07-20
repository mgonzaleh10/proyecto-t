const express = require('express');
const router = express.Router();
const {
  crearDisponibilidad,
  listarDisponibilidades,
  eliminarDisponibilidad,
  eliminarTodas
} = require('../controllers/disponibilidades.controller');

router.post('/', crearDisponibilidad);
router.get('/', listarDisponibilidades);

// borrado
router.delete('/:id', eliminarDisponibilidad);
router.delete('/', eliminarTodas);

module.exports = router;