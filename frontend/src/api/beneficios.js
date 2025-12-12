import client from './client';

export const getBeneficios = () => client.get('/beneficios');

export const crearBeneficio = ({ id_usuario, tipo, fecha, descripcion }) =>
  client.post('/beneficios', { id_usuario, tipo, fecha, descripcion });

export const updateBeneficio = (id, data) =>
  client.put(`/beneficios/beneficio/${id}`, data);

export const eliminarBeneficio = (id) =>
  client.delete(`/beneficios/beneficio/${id}`);
