import React, { useState } from 'react';
import { getResumenTurnos } from '../api/resumenTurnos';

export default function ResumenTurnosPage() {
  // Ahora usamos directamente las claves que el API espera
  const [fechas, setFechas] = useState({
    fechaInicio: '',
    fechaFin: ''
  });
  const [resumen, setResumen] = useState([]);
  const [error, setError]     = useState(null);

  const fetchResumen = async () => {
    setError(null);

    // Validación rápida
    if (!fechas.fechaInicio || !fechas.fechaFin) {
      setError('Debes seleccionar ambas fechas.');
      return;
    }

    try {
      const { data } = await getResumenTurnos({
        fechaInicio: fechas.fechaInicio,
        fechaFin:    fechas.fechaFin
      });
      setResumen(data);
    } catch (e) {
      console.error(e);
      setError('No se pudo cargar el resumen.');
    }
  };

  return (
    <div style={{ maxWidth:800, margin:'2rem auto', fontFamily:'Arial' }}>
      <h2>Resumen de Turnos</h2>

      <div style={{ display:'flex', gap:'1rem', marginBottom:'1rem' }}>
        <label>
          Desde:<br/>
          <input
            type="date"
            value={fechas.fechaInicio}
            onChange={e => setFechas(f => ({ ...f, fechaInicio: e.target.value }))}
          />
        </label>
        <label>
          Hasta:<br/>
          <input
            type="date"
            value={fechas.fechaFin}
            onChange={e => setFechas(f => ({ ...f, fechaFin: e.target.value }))}
          />
        </label>
        <button onClick={fetchResumen} style={{ alignSelf:'end' }}>
          Cargar
        </button>
      </div>

      {error && <p style={{ color:'red' }}>{error}</p>}

      {resumen.length > 0 && (
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Crew</th>
              <th style={th}>Total Turnos</th>
              <th style={th}>Aperturas</th>
              <th style={th}>Cierres</th>
            </tr>
          </thead>
          <tbody>
            {resumen.map(r => (
              <tr key={r.usuario_id}>
                <td style={td}>{r.nombre}</td>
                <td style={td}>{r.total_turnos}</td>
                <td style={td}>{r.aperturas}</td>
                <td style={td}>{r.cierres}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th = {
  border: '1px solid #ccc',
  padding: '0.5rem',
  background: '#f0f0f0'
};
const td = {
  border: '1px solid #ccc',
  padding: '0.5rem',
  textAlign: 'center'
};