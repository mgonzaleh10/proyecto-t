// src/App.jsx
import React from 'react';
import { Routes, Route, Link } from 'react-router-dom';

import BKNav from './components/BKNav'; // ⬅️ navbar pro

import Home from './pages/Home';
import TurnosPage from './pages/TurnosPage';
import Intercambio from './pages/Intercambio';
import UsuariosPage from './pages/UsuariosPage';
import PlanillaTurnos from './pages/PlanillaTurnos';
import PlanillaTurnosManual from './pages/PlanillaTurnosManual';
import DisponibilidadesPage from './pages/DisponibilidadesPage';
import BeneficiosPage from './pages/BeneficiosPage';
import ResumenTurnosPage from './pages/ResumenTurnosPage';
import HorariosPage from './pages/HorariosPage';
import LicenciasPage from './pages/LicenciasPage';

export default function App() {
  return (
    <>
      {/* Navbar mejorado */}
      <BKNav />

      {/* Contenido de cada página */}
      <main style={{ padding: '2rem' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/turnos" element={<TurnosPage />} />
          <Route path="/intercambio" element={<Intercambio />} />
          <Route path="/usuarios" element={<UsuariosPage />} />
          <Route path="/planilla" element={<PlanillaTurnos />} />
          <Route path="/planilla-manual" element={<PlanillaTurnosManual />} />
          <Route path="/disponibilidades" element={<DisponibilidadesPage />} />
          <Route path="/beneficios" element={<BeneficiosPage />} />
          <Route path="/resumen" element={<ResumenTurnosPage />} />
          <Route path="/horarios" element={<HorariosPage />} />
          <Route path="/licencias" element={<LicenciasPage />} />

          {/* 404 */}
          <Route
            path="*"
            element={
              <div>
                <h2>404 – Página no encontrada</h2>
                <Link to="/">Volver al inicio</Link>
              </div>
            }
          />
        </Routes>
      </main>
    </>
  );
}
