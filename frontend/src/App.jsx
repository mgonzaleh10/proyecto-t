import React from 'react'; // Importo React para usar JSX
import { Routes, Route, Link } from 'react-router-dom'; // Importo componentes de ruteo

import Home from './pages/Home'; // Importo la página de inicio
import TurnosPage from './pages/TurnosPage'; // Importo la página de listado de turnos
import Intercambio from './pages/Intercambio'; // Importo la página de intercambio de turnos
import UsuariosPage from './pages/UsuariosPage'; // Importo la página de gestión de crews
import PlanillaTurnos from './pages/PlanillaTurnos'; // Importo la página de planilla automática
import PlanillaTurnosManual from './pages/PlanillaTurnosManual'; // Importo la página de planilla manual
import DisponibilidadesPage from './pages/DisponibilidadesPage'; // Importo la página de disponibilidades
import BeneficiosPage from './pages/BeneficiosPage';
import ResumenTurnosPage      from './pages/ResumenTurnosPage';
import HorariosPage from './pages/HorariosPage'; // 👈 importa tu nueva página


export default function App() {
  return (
    <>
      {/* Header con enlaces de navegación principal */}
      <header style={{ padding: '1rem', background: '#f0f0f0' }}>
        <Link to="/" style={{ marginRight: '1rem' }}>🏠 Home</Link> {/* Enlace al inicio */}
        <Link to="/turnos" style={{ marginRight: '1rem' }}>Turnos</Link> {/* Enlace a Turnos */}
        <Link to="/intercambio" style={{ marginRight: '1rem' }}>Intercambio</Link> {/* Enlace a Intercambio */}
        <Link to="/usuarios" style={{ marginRight: '1rem' }}>Crews</Link> {/* Enlace a Crews */}
        <Link to="/planilla" style={{ marginRight: '1rem' }}>Planilla</Link> {/* Enlace a Planilla */}
        <Link to="/planilla-manual" style={{ marginRight: '1rem' }}>Planilla Manual</Link> {/* Enlace a Planilla Manual */}
        <Link to="/disponibilidades">Disponibilidades</Link> {/* Enlace a Disponibilidades */}
        <Link to="/beneficios">Beneficios</Link>
        <Link to="/resumen" style={{ marginRight:'1rem' }}>📈 Resumen</Link>
        <Link to="/horarios" style={{ marginRight: '1rem' }}>📅 Horarios</Link>

      </header>

      {/* Contenedor principal donde se renderizan las rutas */}
      <main style={{ padding: '2rem' }}>
        <Routes> {/* Defino las rutas de la aplicación */}
          <Route path="/" element={<Home />} /> {/* Ruta para Home */}
          <Route path="/turnos" element={<TurnosPage />} /> {/* Ruta para TurnosPage */}
          <Route path="/intercambio" element={<Intercambio />} /> {/* Ruta para Intercambio */}
          <Route path="/usuarios" element={<UsuariosPage />} /> {/* Ruta para UsuariosPage */}
          <Route path="/planilla" element={<PlanillaTurnos />} /> {/* Ruta para PlanillaTurnos */}
          <Route path="/planilla-manual" element={<PlanillaTurnosManual />} /> {/* Ruta para PlanillaTurnosManual */}
          <Route path="/disponibilidades" element={<DisponibilidadesPage />} /> {/* Ruta para DisponibilidadesPage */}
          <Route path="/beneficios" element={<BeneficiosPage />} />
          <Route path="/resumen" element={<ResumenTurnosPage />} />
          <Route path="/horarios" element={<HorariosPage />} />


          {/* Ruta comodín para mostrar mensaje 404 */}
          <Route
            path="*"
            element={
              <div>
                <h2>404 – Página no encontrada</h2> {/* Mensaje de error 404 */}
                <Link to="/">Volver al inicio</Link> {/* Enlace de regreso */}
              </div>
            }
          />
        </Routes>
      </main>
    </>
  );
}