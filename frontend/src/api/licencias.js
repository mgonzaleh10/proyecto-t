import client from './client';

export const crearLicencia = async (licencia) => {
  const res = await client.post('/licencias', licencia);
  return res.data;
};

export const obtenerLicencias = async () => {
  const res = await client.get('/licencias');
  return res.data;
};

export const obtenerLicenciasPorUsuario = async (usuarioId) => {
  const res = await client.get(`/licencias/usuario/${usuarioId}`);
  return res.data;
};

export const eliminarLicencia = async (id) => {
  const res = await client.delete(`/licencias/${id}`);
  return res.data;
};
