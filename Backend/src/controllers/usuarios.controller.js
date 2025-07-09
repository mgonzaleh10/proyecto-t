const { crearNuevoUsuario, obtenerUsuarios } = require('../models/usuario.model');

const crearUsuario = async (req, res) => {
    const { nombre, correo, contrasena, rol } = req.body;
    try {
        await crearNuevoUsuario({ nombre, correo, contrasena, rol });
        res.status(201).json({ mensaje: 'Usuario creado correctamente' });
    } catch (error) {
        console.error('❌ Error al crear usuario:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};

const listarUsuarios = async (req, res) => {
  try {
    const lista = await obtenerUsuarios();
    res.json(lista);
  } catch (error) {
        console.error('❌ Error al obtener usuarios:', error);
        res.status(500).json({ error: 'Error del servidor' });
    }
};


module.exports = {
    crearUsuario,
    listarUsuarios
};