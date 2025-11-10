// src/api/intercambios.jsx
import client from './client.jsx';

// Recomendaciones (swap + cobertura)
export const recomendarIntercambio = (payload) =>
  client.post('/intercambios/recomendar', payload);

// Confirmar un intercambio/cobertura
// payload esperado:
//  { tipo: 'swap'|'cobertura',
//    turno_origen_id, usuario_solicitante, usuario_candidato, fecha,
//    turno_destino_id? (solo para swap) }
export const confirmarIntercambio = (payload) =>
  client.post('/intercambios/confirmar', payload);

// Historial (opcional: ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD)
export const listarIntercambios = (params = {}) =>
  client.get('/intercambios/historial', { params });
