import React from 'react';
import TurnoCard from './TurnoCard';

export default function TurnosList({ turnos }) {
  if (!turnos.length) return <p>No hay turnos.</p>;
  return (
    <div>
      {turnos.map(t => <TurnoCard key={`${t.usuario_id}-${t.fecha}-${t.hora_inicio}`} turno={t} />)}
    </div>
  );
}