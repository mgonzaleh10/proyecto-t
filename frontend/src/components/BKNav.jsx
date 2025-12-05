import React from "react";
import { NavLink } from "react-router-dom";
import "./bk-nav.css";

export default function BKNav() {
  return (
    <nav className="bk-nav">
      <div className="bk-nav-inner">
        <div className="links">
          <NavLink to="/" end className="pill">Home</NavLink>
          <NavLink to="/usuarios" className="pill">Crews</NavLink>
          <NavLink to="/disponibilidades" className="pill">Disponibilidades</NavLink>
          <NavLink to="/planilla-manual" className="pill">Planilla de Turnos</NavLink>
          <NavLink to="/planilla" className="pill">Planilla de Turnos 2</NavLink>
          <NavLink to="/intercambio" className="pill">Intercambio de Turnos</NavLink>
          <NavLink to="/beneficios" className="pill">Beneficios</NavLink>
          <NavLink to="/licencias" className="pill">Licencias</NavLink>
          <NavLink to="/resumen" className="pill">Resumen y Métricas</NavLink>
          <NavLink to="/horarios" className="pill">Horarios</NavLink>
        </div>
      </div>
    </nav>
  );
}
