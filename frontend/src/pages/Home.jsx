import React from 'react';
import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Bienvenido al Sistema de Turnos</h1>
      <nav style={{ marginTop: '1rem' }}>
        <Link to="/turnos" style={{ marginRight: '1rem' }}>
          📋 Ver Turnos
        </Link>
        <Link to="/intercambio">
          🔄 Sugerir Intercambio
        </Link>
      </nav>
    </div>
  );
}