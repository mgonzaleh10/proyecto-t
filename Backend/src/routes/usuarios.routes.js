// Importo express y creo el router
const express = require('express');
const router = express.Router();
const {
  crearUsuario,
  listarUsuarios,
  eliminarUsuario
} = require('../controllers/usuarios.controller');

// Creo un nuevo usuario
router.post('/', crearUsuario);
// Obtengo todos los usuarios
router.get('/', listarUsuarios);
// Elimino un usuario por ID
router.delete('/:id', eliminarUsuario);

module.exports = router; // Exporto el router de usuarios