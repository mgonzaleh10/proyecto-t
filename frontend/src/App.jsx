import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import Home from './pages/Home';
import TurnosPage from './pages/TurnosPage';
import Intercambio from './pages/Intercambio';
import UsuariosPage from './pages/UsuariosPage';    // 👈 importa nueva página
import PlanillaTurnos from './pages/PlanillaTurnos'; // si la tienes

export default function App() {
  return (
    <>
      <header style={{ padding: '1rem', background: '#f0f0f0' }}>
        <Link to="/" style={{ marginRight: '1rem' }}>🏠 Home</Link>
        <Link to="/turnos" style={{ marginRight: '1rem' }}>Turnos</Link>
        <Link to="/intercambio" style={{ marginRight: '1rem' }}>Intercambio</Link>
        <Link to="/usuarios">Crews</Link> {/* 👈 nuevo link */}
      </header>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/turnos" element={<TurnosPage />} />
          <Route path="/intercambio" element={<Intercambio />} />
          <Route path="/usuarios" element={<UsuariosPage />} />      {/* 👈 ruta */}
          <Route path="/planilla" element={<PlanillaTurnos />} />    {/* opcional */}
          <Route path="*" element={<h2>404 – Página no encontrada</h2>} />
        </Routes>
      </main>
    </>
  );
}