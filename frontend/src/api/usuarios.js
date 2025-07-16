import client from './client';

export function getUsuarios() {
  return client.get('/usuarios');
}

export function crearUsuario(body) {
  return client.post('/usuarios', body);
}

export function eliminarUsuario(id) {
  return client.delete(`/usuarios/${id}`);
}