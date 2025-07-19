import client from './client';

export function getDisponibilidades() {
  return client.get('/disponibilidades');
}

export function crearDisponibilidad(body) {
  // body puede ser un objeto { usuario_id, dia_semana, hora_inicio, hora_fin }
  // o un array de ellos, según tu controlador
  return client.post('/disponibilidades', body);
}

export function eliminarDisponibilidad(id) {
  return client.delete(`/disponibilidades/${id}`);
}

export function eliminarTodasDisponibilidades() {
  return client.delete('/disponibilidades');
}