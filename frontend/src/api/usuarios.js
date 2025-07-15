import client from './client';

/** Devuelve la lista de crews (usuarios) */
export function getUsuarios() {
  return client.get('/usuarios');
}