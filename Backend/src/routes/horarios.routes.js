const express = require('express');
const router = express.Router();
const { obtenerHorarios } = require('../controllers/horarios.controller');

router.get('/', obtenerHorarios);

module.exports = router;