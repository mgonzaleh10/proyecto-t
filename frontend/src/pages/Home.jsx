import React from 'react';
import { Link } from 'react-router-dom';
import bkLogo from '../assets/burgerking.png';
import './Home.css';

export default function Home() {
  const links = [
    { to: '/horarios',          icon: '🗓️', title: 'Horarios',            desc: 'Planilla semanal generada' },
    { to: '/turnos',            icon: '📋', title: 'Turnos',              desc: 'Listado y gestión de turnos' },
    { to: '/resumen',    icon: '📈', title: 'Resumen',             desc: 'Horas y métricas por usuario' },
    { to: '/planilla',          icon: '🧾', title: 'Planilla Automática', desc: 'Vista de planilla generada' },
    { to: '/planilla-manual',   icon: '✍️', title: 'Planilla Manual',     desc: 'Edición y ajustes manuales' },
    { to: '/usuarios',          icon: '👥', title: 'Crews',               desc: 'Listado y edición de usuarios' },
    { to: '/usuarios',     icon: '➕', title: 'Nuevo Crew',           desc: 'Crear un nuevo usuario' },
    { to: '/licencias',         icon: '🏖️', title: 'Licencias',           desc: 'Ausencias, permisos, licencias' },
    { to: '/beneficios',        icon: '🎁', title: 'Beneficios',           desc: 'Cumpleaños, administrativos, vacaciones' },
    { to: '/disponibilidades',  icon: '⏰', title: 'Disponibilidades',     desc: 'Ventanas de trabajo por día' },
    { to: '/intercambio',       icon: '🔄', title: 'Intercambio',          desc: 'Sugerencias de swap/cover' },
  ];

  return (
    <div className="home">
      {/* Hero */}
      <header className="home-hero">
        <div className="hero-left">
          <h1>
            Sistema de Turnos <span>BK</span>
          </h1>
          <p className="tagline">
            Organiza, visualiza y optimiza turnos con estilo 🍔
          </p>
          <div className="cta-row">
            <Link to="/horarios" className="btn btn-primary">Ver Horarios</Link>
            <Link to="/intercambio" className="btn btn-outline">Intercambio de turnos</Link>
          </div>
        </div>
        <div className="hero-right">
          <img src={bkLogo} alt="Burger King" />
        </div>
      </header>

      {/* Grid de accesos */}
      <section className="home-grid">
        {links.map(({ to, icon, title, desc }) => (
          <Link key={to} to={to} className="card-link">
            <div className="nav-card">
              <div className="icon">{icon}</div>
              <div className="info">
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <footer className="home-footer">
        <small>
          © {new Date().getFullYear()} Sistema de Turnos — Burger King Theme
        </small>
      </footer>
    </div>
  );
}
