import client from './client';

export const getDisponibilidades = () => client.get('/disponibilidades');

export const crearDisponibilidad = (body) =>
  client.post('/disponibilidades', body);

export const eliminarDisponibilidad = (id) =>
  client.delete(`/disponibilidades/${id}`);

export const eliminarTodasDisponibilidades = () =>
  client.delete('/disponibilidades');
