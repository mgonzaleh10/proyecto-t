import React from 'react';
import { Link } from 'react-router-dom';
import bkLogo from '../assets/burgerking.png'; // PNG con fondo transparente
import './Home.css';

export default function Home() {

  const links = [
    { to: '/usuarios', icon: '👥', title: 'Crews', desc: 'Listado y edición de usuarios' },
    { to: '/horarios', icon: '🗓️', title: 'Horarios', desc: 'Planilla semanal generada' },
    { to: '/turnos', icon: '📋', title: 'Turnos', desc: 'Listado y gestión de turnos' },
    { to: '/resumen', icon: '📈', title: 'Resumen', desc: 'Horas y métricas' },
    { to: '/planilla', icon: '🧾', title: 'Planilla Automática', desc: 'Vista planilla generada' },
    { to: '/planilla-manual', icon: '✍️', title: 'Planilla Manual', desc: 'Edición manual' },
    { to: '/licencias', icon: '🏖️', title: 'Licencias', desc: 'Permisos y ausencias' },
    { to: '/beneficios', icon: '🎁', title: 'Beneficios', desc: 'Cumpleaños, administrativos...' },
    { to: '/disponibilidades', icon: '⏰', title: 'Disponibilidades', desc: 'Ventanas por día' },
    { to: '/intercambio', icon: '🔄', title: 'Intercambio', desc: 'Swap & covers' },
  ];

  return (
    <div className="home">

      {/* HEADER */}
      <header className="home-header">
        <div className="header-inner">

          {/* Logo con badge detrás (forma tipo pan) */}
          <div className="logo-wrap">
            <span className="logo-badge" aria-hidden="true"></span>
            <img src={bkLogo} alt="Burger King" className="bk-logo" />
          </div>

          <div>
            <h1 className="poster-title">SISTEMA<br/>DE TURNOS</h1>
            <p className="poster-sub">Gestión semanal • Cobertura • Métricas</p>

            <div className="poster-cta">
              <Link to="/horarios" className="btn btn-ketchup">Ver Horarios</Link>
              <Link to="/intercambio" className="btn btn-ghost">Intercambio de Turnos</Link>
            </div>
          </div>

        </div>
      </header>

      {/* GRID */}
      <section className="home-grid">
        {links.map(({ to, icon, title, desc }) => (
          <Link key={to} to={to} className="card-link">
            <div className="nav-card">
              <div className="icon">{icon}</div>
              <div className="info">
                <h3 className="card-title">{title}</h3>
                <p className="card-desc">{desc}</p>
              </div>
              <div className="chev">›</div>
            </div>
          </Link>
        ))}
      </section>

      {/* FOOTER */}
      <footer className="home-footer">
        © {new Date().getFullYear()} Sistema de Turnos — Estilo Burger King
      </footer>

    </div>
  );
}
