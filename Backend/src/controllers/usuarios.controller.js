const {
  crearNuevoUsuario,
  obtenerUsuarios,
  eliminarUsuarioPorId,
  actualizarUsuario   // importo el nuevo método
} = require('../models/usuario.model'); // Importo funciones del modelo de usuarios

// ⬇️ Importo el servicio de sincronización con Excel (hoja "Trabajador")
const { syncTrabajadoresSheet } = require('../services/excelSync');

const crearUsuario = async (req, res) => {
  // Desestructuro datos del body
  let {
    nombre,
    correo,
    contrasena,
    rol,
    horas_contrato,
    puede_cerrar
  } = req.body;

  // Compruebo que vengan los campos obligatorios
  if (!nombre || !correo || horas_contrato == null || puede_cerrar == null) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  // Asigno contraseña por defecto si no se proporciona
  if (!contrasena) contrasena = 'pass123';

  // Asigno rol por defecto si no se proporciona
  if (!rol) rol = 'crew';

  // Convierto horas_contrato a número y compruebo que sea válido
  const permitted = [45, 30, 20, 16];
  horas_contrato = Number(horas_contrato);
  if (!permitted.includes(horas_contrato)) {
    return res
      .status(400)
      .json({ error: 'Horas de contrato debe ser 45, 30, 20 o 16' });
  }

  // Convierto puede_cerrar a boolean (acepto "si"/"no" o true/false)
  if (typeof puede_cerrar === 'string') {
    puede_cerrar = /^si$/i.test(puede_cerrar) || /^true$/i.test(puede_cerrar);
  } else {
    puede_cerrar = Boolean(puede_cerrar);
  }

  try {
    // Creo el nuevo usuario en la base de datos
    const usuario = await crearNuevoUsuario({
      nombre,
      correo,
      contrasena,
      rol,
      horas_contrato,
      puede_cerrar
    });

    // 🔄 Sincronizo Excel (hoja "Trabajador") en background
    //    No bloqueo la respuesta; si falla, solo registro en logs.
    syncTrabajadoresSheet()
      .catch(err => console.error('Excel sync (crear) falló:', err));

    // Devuelvo el usuario creado con estado 201
    res.status(201).json(usuario);
  } catch (error) {
    console.error('❌ Error al crear usuario:', error);
    // Devuelvo error de servidor
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const listarUsuarios = async (_req, res) => {
  try {
    // Obtengo todos los usuarios
    const lista = await obtenerUsuarios();
    res.json(lista);
  } catch (error) {
    console.error('❌ Error al obtener usuarios:', error);
    // Devuelvo error de servidor
    res.status(500).json({ error: 'Error del servidor' });
  }
};

const eliminarUsuario = async (req, res) => {
  // Obtengo id del usuario desde params
  const { id } = req.params;
  try {
    // Elimino el usuario por su ID
    const eliminado = await eliminarUsuarioPorId(id);
    // Compruebo si efectivamente existía
    if (!eliminado) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // 🔄 Sincronizo Excel luego de eliminar
    syncTrabajadoresSheet()
      .catch(err => console.error('Excel sync (delete) falló:', err));

    // Devuelvo mensaje de eliminación exitosa
    res.json({ mensaje: 'Usuario eliminado', usuario: eliminado });
  } catch (error) {
    console.error('❌ Error al eliminar usuario:', error);
    // Devuelvo error de servidor
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

  // Validar campos obligatorios mínimos (nombre y correo)
  if (!nombre || !correo) {
    return res.status(400).json({ error: 'Nombre y correo son obligatorios.' });
  }

  // Contraseña por defecto si no se envía
  if (!contrasena) contrasena = 'pass123';
  // Rol por defecto
  if (!rol) rol = 'crew';

  // Validar horas_contrato
  const permitted = [45, 30, 20, 16];
  horas_contrato = Number(horas_contrato);
  if (!permitted.includes(horas_contrato)) {
    return res
      .status(400)
      .json({ error: 'Horas de contrato debe ser 45, 30, 20 o 16' });
  }

  // Parsear puede_cerrar
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

    // 🔄 Sincronizo Excel luego de actualizar
    syncTrabajadoresSheet()
      .catch(err => console.error('Excel sync (update) falló:', err));

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
  editarUsuario   // exporto el nuevo controlador
};