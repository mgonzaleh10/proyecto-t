import client from './client';

export const getUsuarios = () => client.get('/usuarios');

export const crearUsuario = (body) =>
  client.post('/usuarios', body);

export const eliminarUsuario = (id) =>
  client.delete(`/usuarios/${id}`);

export const updateUsuario = (id, body) =>
  client.put(`/usuarios/${id}`, body);
