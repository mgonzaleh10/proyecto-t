import React from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import TurnosPage from './pages/TurnosPage'
import Intercambio from './pages/Intercambio'
import UsuariosPage from './pages/UsuariosPage'
import PlanillaTurnos from './pages/PlanillaTurnos'

export default function App() {
  return (
    <>
      <header style={{ padding: '1rem', background: '#f0f0f0' }}>
        <Link to="/" style={{ marginRight: '1rem' }}>🏠 Home</Link>
        <Link to="/turnos" style={{ marginRight: '1rem' }}>Turnos</Link>
        <Link to="/intercambio" style={{ marginRight: '1rem' }}>Intercambio</Link>
        <Link to="/usuarios" style={{ marginRight: '1rem' }}>Crews</Link>
        <Link to="/planilla">Planilla</Link>
      </header>

      <main style={{ padding: '2rem' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/turnos" element={<TurnosPage />} />
          <Route path="/intercambio" element={<Intercambio />} />
          <Route path="/usuarios" element={<UsuariosPage />} />
          <Route path="/planilla" element={<PlanillaTurnos />} />

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
  )
}