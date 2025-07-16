const express = require('express');
const router = express.Router();
const {
  crearUsuario,
  listarUsuarios,
  eliminarUsuario
} = require('../controllers/usuarios.controller');

// Crear nuevo crew
router.post('/', crearUsuario);

// Listar todos los crews
router.get('/', listarUsuarios);

// Eliminar crew por ID
router.delete('/:id', eliminarUsuario);

module.exports = router;