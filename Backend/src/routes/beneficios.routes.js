const express = require('express');
const router  = express.Router();
const {
  registrarBeneficio,
  obtenerBeneficios,
  actualizarBeneficio,
  eliminarBeneficio
} = require('../controllers/beneficios.controller');

// Obtengo todos los beneficios
router.get('/', obtenerBeneficios);

// Registro un nuevo beneficio
router.post('/', registrarBeneficio);

// Actualizo un beneficio existente
router.put('/beneficio/:id', actualizarBeneficio);

// Elimino un beneficio
router.delete('/beneficio/:id', eliminarBeneficio);

module.exports = router;