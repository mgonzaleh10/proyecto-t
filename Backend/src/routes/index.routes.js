const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ mensaje: 'API de gestión de horarios en funcionamiento' });
});

module.exports = router;