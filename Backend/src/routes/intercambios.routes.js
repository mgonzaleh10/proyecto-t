// src/routes/intercambios.routes.js (CommonJS)
const { Router } = require('express');
const {
  recomendarIntercambio,
  confirmarIntercambio,
  listarIntercambios
} = require('../controllers/intercambios.controller.js');

const router = Router();

router.post('/recomendar', recomendarIntercambio);
router.post('/confirmar',  confirmarIntercambio);
router.get('/historial',   listarIntercambios);

module.exports = router;
