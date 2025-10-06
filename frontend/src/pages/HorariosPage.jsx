import React from "react";
import "./HorariosPage.css";
import logo from "../assets/burgerking.png"; // tu logo aquí

export default function HorariosPage() {
  return (
    <div className="schedule-container">
      <h1 className="schedule-title">HORARIO CREW</h1>

      <table className="schedule-table">
        <thead>
          <tr>
            <th>EMPLEADO</th>
            <th>LUNES</th>
            <th>MARTES</th>
            <th>MIÉRCOLES</th>
            <th>JUEVES</th>
            <th>VIERNES</th>
            <th>DOMINGO</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>8:00–4:00</td>
            <td>9:00–3:00</td>
            <td>9:00–3:00</td>
            <td>8:00–4:00</td>
            <td>8:00–4:00</td>
            <td>8:00–4:00</td>
          </tr>
        </tbody>
      </table>

      <div className="schedule-logo">
        <img src={logo} alt="Burger King Logo" />
      </div>
    </div>
  );
}
