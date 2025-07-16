const {
  crearNuevoUsuario,
  obtenerUsuarios,
  eliminarUsuarioPorId
} = require('../models/usuario.model');

const crearUsuario = async (req, res) => {
  let {
    nombre,
    correo,
    contrasena,
    rol,
    horas_contrato,
    puede_cerrar
  } = req.body;

  // Campos obligatorios
  if (!nombre || !correo || horas_contrato == null || puede_cerrar == null) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  // contraseña por defecto
  if (!contrasena) contrasena = 'pass123';

  // rol por defecto
  if (!rol) rol = 'crew';

  // validar horas_contrato
  const permitted = [45, 30, 20, 16];
  horas_contrato = Number(horas_contrato);
  if (!permitted.includes(horas_contrato)) {
    return res
      .status(400)
      .json({ error: 'Horas de contrato debe ser 45, 30, 20 o 16' });
  }

  // parsear puede_cerrar (acepta true/false o "si"/"no")
  if (typeof puede_cerrar === 'string') {
    puede_cerrar = /^si$/i.test(puede_cerrar) || /^true$/i.test(puede_cerrar);
  } else {
    puede_cerrar = Boolean(puede_cerrar);
  }

  try {
    const usuario = await crearNuevoUsuario({
      nombre,
      correo,
      contrasena,
      rol,
      horas_contrato,
      puede_cerrar
    });
    res.status(201).json(usuario);
  } catch (error) {
    console.error('❌ Error al crear usuario:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const listarUsuarios = async (_req, res) => {
  try {
    const lista = await obtenerUsuarios();
    res.json(lista);
  } catch (error) {
    console.error('❌ Error al obtener usuarios:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const eliminarUsuario = async (req, res) => {
  const { id } = req.params;
  try {
    const eliminado = await eliminarUsuarioPorId(id);
    if (!eliminado) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ mensaje: 'Usuario eliminado', usuario: eliminado });
  } catch (error) {
    console.error('❌ Error al eliminar usuario:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = {
  crearUsuario,
  listarUsuarios,
  eliminarUsuario
};