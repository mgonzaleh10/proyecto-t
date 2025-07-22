import client from './client'; // Importo el cliente axios

// Obtengo todos los usuarios
export function getUsuarios() {
  return client.get('/usuarios');
}

// Creo un nuevo usuario
export function crearUsuario(body) {
  return client.post('/usuarios', body);
}

// Elimino un usuario por su ID
export function eliminarUsuario(id) {
  return client.delete(`/usuarios/${id}`);
}

// Nuevo: actualizar usuario existente
export function updateUsuario(id, body) {
  return client.put(`/usuarios/${id}`, body);
}