const express = require('express');
const router = express.Router();
const { registrarBeneficio, obtenerBeneficios } = require('../controllers/beneficios.controller');

router.get('/', obtenerBeneficios);
router.post('/', registrarBeneficio);

module.exports = router;