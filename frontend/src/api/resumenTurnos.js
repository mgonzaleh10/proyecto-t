import client from './client';

/**
 * @param {string} fechaInicio — 'YYYY-MM-DD'
 * @param {string} fechaFin    — 'YYYY-MM-DD'
 */
export function getResumenTurnos({ fechaInicio, fechaFin }) {
  return client.get('/turnos/resumen/listado', {
    params: { fechaInicio, fechaFin }
  });
}
