// Importo express y creo el router
const express = require('express');
const router = express.Router();
const { registrarBeneficio, obtenerBeneficios } = require('../controllers/beneficios.controller');

// Obtengo todos los beneficios
router.get('/', obtenerBeneficios);
// Registro un nuevo beneficio
router.post('/', registrarBeneficio);

module.exports = router; // Exporto el router de beneficios