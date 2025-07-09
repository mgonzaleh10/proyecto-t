const express = require('express');
const router = express.Router();
const { registrarDisponibilidad, listarDisponibilidades, } = require('../controllers/disponibilidades.controller');

router.post('/', registrarDisponibilidad);
router.get('/', listarDisponibilidades);

module.exports = router;