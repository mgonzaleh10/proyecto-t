const express = require('express');
const router = express.Router();
const {
  registrarLicencia,
  listarLicencias,
  listarLicenciasPorUsuario,
  borrarLicencia
} = require('../controllers/licencias.controller');

// Crear licencia
router.post('/', registrarLicencia);

// Listar todas
router.get('/', listarLicencias);

// Listar por usuario
router.get('/usuario/:usuario_id', listarLicenciasPorUsuario);

// Eliminar
router.delete('/:id', borrarLicencia);

module.exports = router;
