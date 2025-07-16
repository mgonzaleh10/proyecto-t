import React, { useEffect, useState } from 'react';
import {
  getTurnos,
  eliminarTurno,
  eliminarTodosTurnos
} from '../api/turnos';

export default function TurnosPage() {
  const [turnos, setTurnos] = useState([]);
  const [error, setError] = useState(null);

  const fetchTurnos = () => {
    getTurnos()
      .then(res => setTurnos(res.data))
      .catch(err => {
        console.error(err);
        setError('No se pudieron cargar los turnos.');
      });
  };

  useEffect(() => {
    fetchTurnos();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este turno?')) return;
    try {
      await eliminarTurno(id);
      fetchTurnos();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el turno.');
    }
  };

  const handleDeleteAll = async () => {
    if (!window.confirm('¿Eliminar TODOS los turnos?')) return;
    try {
      await eliminarTodosTurnos();
      fetchTurnos();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar todos los turnos.');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Listado de Turnos</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <button
        onClick={handleDeleteAll}
        style={{ marginBottom: '1rem', background: '#c00', color: '#fff', padding: '0.5rem' }}
      >
        Eliminar todos los turnos
      </button>

      <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Crew</th>
            <th>Fecha</th>
            <th>Inicio</th>
            <th>Fin</th>
            <th>Creado por</th>
            <th>Observaciones</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {turnos.map(t => (
            <tr key={t.id}>
              <td>{t.id}</td>
              <td>{t.usuario_id}</td>
              <td>{new Date(t.fecha).toLocaleDateString()}</td>
              <td>{t.hora_inicio}</td>
              <td>{t.hora_fin}</td>
              <td>{t.creado_por}</td>
              <td>{t.observaciones}</td>
              <td>
                <button
                  onClick={() => handleDelete(t.id)}
                  style={{ background: '#c00', color: '#fff', padding: '0.3rem 0.6rem' }}
                >
                  Eliminar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}