import api from "./client";

// Crear licencia
export const crearLicencia = async (licencia) => {
  const res = await api.post("/licencias", licencia);
  return res.data;
};

// Listar todas
export const obtenerLicencias = async () => {
  const res = await api.get("/licencias");
  return res.data;
};

// Listar por usuario
export const obtenerLicenciasPorUsuario = async (usuarioId) => {
  const res = await api.get(`/licencias/usuario/${usuarioId}`);
  return res.data;
};

// Eliminar licencia
export const eliminarLicencia = async (id) => {
  const res = await api.delete(`/licencias/${id}`);
  return res.data;
};
