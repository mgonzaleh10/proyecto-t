import client from './client';

export const getResumenTurnos = ({ fechaInicio, fechaFin }) =>
  client.get('/turnos/resumen/listado', {
    params: { fechaInicio, fechaFin },
  });
