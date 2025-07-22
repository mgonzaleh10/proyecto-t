import React, { useEffect, useState } from 'react'; // Importo React y hooks
import {
  getTurnos,
  eliminarTurno,
  eliminarTodosTurnos
} from '../api/turnos'; // Importo funciones de la API de turnos

export default function TurnosPage() {
  // Defino estado para la lista de turnos
  const [turnos, setTurnos] = useState([]);
  // Defino estado para errores
  const [error, setError] = useState(null);

  // Función para obtener turnos del servidor
  const fetchTurnos = () => {
    getTurnos()
      .then(res => setTurnos(res.data)) // Guardo los turnos en estado
      .catch(err => {
        console.error(err);
        setError('No se pudieron cargar los turnos.'); // Seteo mensaje de error
      });
  };

  // Al montar el componente, cargo los turnos
  useEffect(() => {
    fetchTurnos();
  }, []);

  // Manejo eliminar un turno individual
  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este turno?')) return;
    try {
      await eliminarTurno(id);
      fetchTurnos(); // Recargo la lista tras eliminar
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el turno.');
    }
  };

  // Manejo eliminar todos los turnos
  const handleDeleteAll = async () => {
    if (!window.confirm('¿Eliminar TODOS los turnos?')) return;
    try {
      await eliminarTodosTurnos();
      fetchTurnos(); // Recargo la lista tras eliminar todo
    } catch (err) {
      console.error(err);
      alert('Error al eliminar todos los turnos.');
    }
  };

  return (
    <div style={{ padding: '2rem' }}> {/* Contenedor principal */}
      <h2>Listado de Turnos</h2> {/* Título de la página */}
      {error && <p style={{ color: 'red' }}>{error}</p>} {/* Mensaje de error */}

      {/* Botón para eliminar todos los turnos */}
      <button
        onClick={handleDeleteAll}
        style={{ marginBottom: '1rem', background: '#c00', color: '#fff', padding: '0.5rem' }}
      >
        Eliminar todos los turnos
      </button>

      {/* Tabla de turnos */}
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
                {/* Botón para eliminar turno individual */}
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