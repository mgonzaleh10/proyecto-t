const express = require('express');
const router = express.Router();

// Respondo con un mensaje de estado de la API
router.get('/', (req, res) => {
  res.json({ mensaje: 'API de gestión de horarios en funcionamiento' });
});

module.exports = router; // Exporto el router principal