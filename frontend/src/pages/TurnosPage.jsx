import React, { useEffect, useState } from 'react';
import { getTurnos } from '../api/turnos';

export default function TurnosPage() {
  const [turnos, setTurnos] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    getTurnos()
      .then(res => {
        setTurnos(res.data);
      })
      .catch(err => {
        console.error(err);
        setError('No se pudieron cargar los turnos.');
      });
  }, []);

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Listado de Turnos</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', marginTop: '1rem' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Crew</th>
            <th>Fecha</th>
            <th>Inicio</th>
            <th>Fin</th>
            <th>Creado por</th>
            <th>Observaciones</th>
          </tr>
        </thead>
        <tbody>
          {turnos.map(t => (
            <tr key={t.id}>
              <td>{t.id}</td>
              <td>{t.usuario_id}</td>
              <td>{new Date(t.fecha).toLocaleDateString()}</td>
              <td>{t.hora_inicio}</td>
              <td>{t.hora_fin}</td>
              <td>{t.creado_por}</td>
              <td>{t.observaciones}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}