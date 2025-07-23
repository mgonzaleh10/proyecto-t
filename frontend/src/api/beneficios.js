import axios from 'axios';

// Creamos una instancia de Axios que apunte a nuestro backend
const api = axios.create({
  baseURL: 'http://localhost:3000'
});

/**
 * Obtiene todos los beneficios.
 * Luego podrás filtrarlos por usuario en el cliente si lo necesitas.
 */
export function getBeneficios() {
  return api.get('/beneficios');
}

/**
 * Crea un nuevo beneficio.
 * @param {Object} payload
 * @param {number} payload.id_usuario  — el ID del crew
 * @param {string} payload.tipo        — e.g. 'cumpleaños'
 * @param {string} payload.fecha       — 'YYYY-MM-DD'
 * @param {string} [payload.descripcion]
 */
export function crearBeneficio({ id_usuario, tipo, fecha, descripcion }) {
  return api.post('/beneficios', {
    id_usuario,
    tipo,
    fecha,
    descripcion
  });
}

/**
 * Actualiza un beneficio existente.
 * @param {number} id     — ID del beneficio
 * @param {Object} data   — { fecha, descripcion }
 */
export function updateBeneficio(id, data) {
  return api.put(`/beneficios/beneficio/${id}`, data);
}

/**
 * Elimina un beneficio.
 * @param {number} id  — ID del beneficio
 */
export function eliminarBeneficio(id) {
  return api.delete(`/beneficios/beneficio/${id}`);
}