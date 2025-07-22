import client from './client'; // Importo el cliente axios

// Obtengo todas las disponibilidades
export function getDisponibilidades() {
  return client.get('/disponibilidades');
}

// Creo una o varias disponibilidades según el body
export function crearDisponibilidad(body) {
  return client.post('/disponibilidades', body);
}

// Elimino una disponibilidad por su ID
export function eliminarDisponibilidad(id) {
  return client.delete(`/disponibilidades/${id}`);
}

// Elimino todas las disponibilidades
export function eliminarTodasDisponibilidades() {
  return client.delete('/disponibilidades');
}