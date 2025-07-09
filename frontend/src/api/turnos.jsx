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