const express = require('express');
const router = express.Router();
const { crearUsuario, listarUsuarios } = require('../controllers/usuarios.controller');

router.post('/', crearUsuario);
router.get('/', listarUsuarios); // 👈 Aquí añadimos el GET

module.exports = router;