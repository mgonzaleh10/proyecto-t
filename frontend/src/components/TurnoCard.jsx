import React from 'react';

export default function TurnoCard({ turno }) {
  return (
    <div className="border p-2 rounded shadow-sm mb-2">
      <strong>Usuario {turno.usuario_id}</strong><br/>
      {new Date(turno.fecha).toLocaleDateString()} {' '}
      {turno.hora_inicio} → {turno.hora_fin}<br/>
      Obs: {turno.observaciones || '—'}
    </div>
  );
}