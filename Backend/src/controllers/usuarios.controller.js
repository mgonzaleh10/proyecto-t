// src/controllers/usuarios.controller.js
const {
  crearNuevoUsuario,
  obtenerUsuarios,
  eliminarUsuarioPorId,
  actualizarUsuario
} = require('../models/usuario.model');

// Servicios de sincronización de Excel
const { syncTrabajadoresSheet } = require('../services/excelSync');
const { syncDisponibilidadesSheet } = require('../services/excelDisponibilidades');

const crearUsuario = async (req, res) => {
  let {
    nombre,
    correo,
    contrasena,
    rol,
    horas_contrato,
    puede_cerrar
  } = req.body;

  if (!nombre || !correo || horas_contrato == null || puede_cerrar == null) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  if (!contrasena) contrasena = 'pass123';
  if (!rol) rol = 'crew';

  const permitted = [45, 30, 20, 16];
  horas_contrato = Number(horas_contrato);
  if (!permitted.includes(horas_contrato)) {
    return res.status(400).json({ error: 'Horas de contrato debe ser 45, 30, 20 o 16' });
  }

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

    // 🔄 IMPORTANTE: sincronizar en orden y esperando (Trabajador → Disponibilidades)
    try {
      await syncTrabajadoresSheet();
      await syncDisponibilidadesSheet();
    } catch (err) {
      console.error('Excel sync (crear) falló:', err);
    }

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

    // 🔄 IMPORTANTE: sincronizar en orden y esperando (Trabajador → Disponibilidades)
    try {
      await syncTrabajadoresSheet();
      await syncDisponibilidadesSheet();
    } catch (err) {
      console.error('Excel sync (delete) falló:', err);
    }

    res.json({ mensaje: 'Usuario eliminado', usuario: eliminado });
  } catch (error) {
    console.error('❌ Error al eliminar usuario:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

// PUT /usuarios/:id
const editarUsuario = async (req, res) => {
  const { id } = req.params;
  let {
    nombre,
    correo,
    contrasena,
    rol,
    horas_contrato,
    puede_cerrar
  } = req.body;

  if (!nombre || !correo) {
    return res.status(400).json({ error: 'Nombre y correo son obligatorios.' });
  }

  if (!contrasena) contrasena = 'pass123';
  if (!rol) rol = 'crew';

  const permitted = [45, 30, 20, 16];
  horas_contrato = Number(horas_contrato);
  if (!permitted.includes(horas_contrato)) {
    return res.status(400).json({ error: 'Horas de contrato debe ser 45, 30, 20 o 16' });
  }

  if (typeof puede_cerrar === 'string') {
    puede_cerrar = /^si$/i.test(puede_cerrar) || /^true$/i.test(puede_cerrar);
  } else {
    puede_cerrar = Boolean(puede_cerrar);
  }

  try {
    const usuario = await actualizarUsuario(id, {
      nombre,
      correo,
      contrasena,
      rol,
      horas_contrato,
      puede_cerrar
    });
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Editar usuario solo requiere actualizar la hoja principal.
    // (Las disponibilidades se recalculan cuando cambien o al eliminar/crear usuarios)
    try {
      await syncTrabajadoresSheet();
    } catch (err) {
      console.error('Excel sync (update) falló:', err);
    }

    res.json(usuario);
  } catch (error) {
    console.error('❌ Error al editar usuario:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
};

module.exports = {
  crearUsuario,
  listarUsuarios,
  eliminarUsuario,
  editarUsuario
};
