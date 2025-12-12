import client from './client';

export const recomendarIntercambio = (payload) =>
  client.post('/intercambios/recomendar', payload);

export const confirmarIntercambio = (payload) =>
  client.post('/intercambios/confirmar', payload);

export const listarIntercambios = (params = {}) =>
  client.get('/intercambios/historial', { params });
