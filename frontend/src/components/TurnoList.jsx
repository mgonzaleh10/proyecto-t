import React from 'react';
import TurnoCard from './TurnoCard';

// TurnosList: renderizo lista de tarjetas de turnos
export default function TurnosList({ turnos }) {
  // Muestro mensaje si no hay turnos
  if (!turnos.length) return <p>No hay turnos.</p>;
  return (
    <div>
      {/* Itero y renderizo cada TurnoCard */}
      {turnos.map(t => (
        <TurnoCard
          key={`${t.usuario_id}-${t.fecha}-${t.hora_inicio}`}
          turno={t}
        />
      ))}
    </div>
  );
}