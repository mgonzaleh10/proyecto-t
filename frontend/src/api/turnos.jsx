// src/api/turnos.jsx
import client from './client.jsx';

// ===== CRUD turnos “clásico” =====
export const getTurnos = () => client.get('/turnos');
export const getTurnosPorFecha = (fecha) => client.get(`/turnos/fecha/${fecha}`);
export const crearTurno = (payload) => client.post('/turnos', payload);
export const updateTurno = (id, payload) => client.put(`/turnos/${id}`, payload);
export const eliminarTurno = (id) => client.delete(`/turnos/${id}`);
export const eliminarTodosTurnos = () => client.delete('/turnos');

// ===== Integración Notebook / Excel =====
export const generarPython = (fechaInicio) =>
  client.post('/turnos/generar-python', { fechaInicio });

// ⬅️ IMPORTANTE: pasamos fechaInicio para anclar la matriz 1..7
export const previewPython = (fechaInicio) =>
  client.get('/turnos/preview-python', { params: { fechaInicio } });

export const commitPython = (items) =>
  client.post('/turnos/commit-python', { items });

// ===== Otros =====
export const enviarCalendario = (payload) =>
  client.post('/turnos/enviar-correo', payload);

// ===== Intercambio de turnos =====
export const intercambio = (payload) =>
  client.post('/turnos/intercambio', payload);
