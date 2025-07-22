// Importo express y creo el router
const express = require('express');
const router = express.Router();
const {
  crearUsuario,
  listarUsuarios,
  eliminarUsuario,
  editarUsuario
} = require('../controllers/usuarios.controller');

// Creo un nuevo usuario
router.post('/', crearUsuario);
// Obtengo todos los usuarios
router.get('/', listarUsuarios);
// Elimino un usuario por ID
router.delete('/:id', eliminarUsuario);
// Editar crew por ID
router.put('/:id', editarUsuario);

module.exports = router; // Exporto el router de usuarios