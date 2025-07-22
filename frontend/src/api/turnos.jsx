import client from './client';

export function getTurnos() {
  return client.get('/turnos');
}

export function getTurnosPorFecha(fecha) {
  return client.get(`/turnos/fecha/${fecha}`);
}

export function getTurnosPorUsuario(id) {
  return client.get(`/turnos/${id}`);
}

export function crearTurno(body) {
  return client.post('/turnos', body);
}

export function generarHorario(body) {
  return client.post('/turnos/generar', body);
}

export function intercambio(body) {
  return client.post('/turnos/intercambio', body);
}

export function eliminarTurno(id) {
  return client.delete(`/turnos/${id}`);
}

export function eliminarTodosTurnos() {
  return client.delete('/turnos');
}

export function updateTurno(id, body) {
  return client.put(`/turnos/${id}`, body);
}

// ← Nueva función para disparar el envío de correos
export function enviarCalendario(body) {
  return client.post('/turnos/enviar-correo', body);
}