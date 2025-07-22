import React from 'react'; // Importo React
import { Link } from 'react-router-dom'; // Importo Link para navegación

export default function Home() {
  return (
    <div style={{ padding: '2rem' }}> {/* Defino el contenedor principal */}
      <h1>Bienvenido al Sistema de Turnos</h1> {/* Muestro el título */}
      <nav style={{ marginTop: '1rem' }}> {/* Defino la barra de navegación */}
        {/* Enlace a la página de turnos */}
        <Link to="/turnos" style={{ marginRight: '1rem' }}>
          📋 Ver Turnos
        </Link>
        {/* Enlace a la página de intercambio */}
        <Link to="/intercambio">
          🔄 Sugerir Intercambio
        </Link>
      </nav>
    </div>
  );
}