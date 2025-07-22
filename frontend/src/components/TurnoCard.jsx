import React from 'react';

// TurnoCard: muestro la información de un turno individual
export default function TurnoCard({ turno }) {
  return (
    <div className="border p-2 rounded shadow-sm mb-2">
      {/* Muestro ID del usuario */}
      <strong>Usuario {turno.usuario_id}</strong><br/>
      {/* Muestro fecha y horas del turno */}
      {new Date(turno.fecha).toLocaleDateString()} {' '}
      {turno.hora_inicio} → {turno.hora_fin}<br/>
      {/* Muestro observaciones o guión si no hay */}
      Obs: {turno.observaciones || '—'}
    </div>
  );
}