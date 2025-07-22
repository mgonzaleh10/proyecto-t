import client from './client'; // Importo el cliente axios

// Obtengo todos los turnos
export function getTurnos() {
  return client.get('/turnos');
}

// Obtengo turnos de una fecha específica
export function getTurnosPorFecha(fecha) {
  return client.get(`/turnos/fecha/${fecha}`);
}

// Obtengo turnos de un usuario por su ID
export function getTurnosPorUsuario(id) {
  return client.get(`/turnos/${id}`);
}

// Registro un nuevo turno
export function crearTurno(body) {
  return client.post('/turnos', body);
}

// Genero el horario automáticamente
export function generarHorario(body) {
  return client.post('/turnos/generar', body);
}

// Solicito intercambio de turnos
export function intercambio(body) {
  return client.post('/turnos/intercambio', body);
}

// Elimino un turno por su ID
export function eliminarTurno(id) {
  return client.delete(`/turnos/${id}`);
}

// Elimino todos los turnos
export function eliminarTodosTurnos() {
  return client.delete('/turnos');
}

// Actualizo un turno existente
export function updateTurno(id, body) {
  return client.put(`/turnos/${id}`, body);
}

// Envío el calendario de turnos por correo
export function enviarCalendario(body) {
  return client.post('/turnos/enviar-correo', body);
}