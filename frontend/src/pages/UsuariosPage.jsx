import React, { useEffect, useState } from 'react'; // Importo React y hooks
import { getUsuarios, eliminarUsuario } from '../api/usuarios'; // Importo API de usuarios
import NuevoUsuario from './NuevoUsuario'; // Importo componente para crear usuarios

export default function UsuariosPage() {
  // Defino estado para la lista de usuarios (crews)
  const [usuarios, setUsuarios] = useState([]);
  // Defino estado para errores
  const [error, setError] = useState(null);

  // Función para cargar usuarios desde el servidor
  const fetchUsuarios = async () => {
    try {
      const res = await getUsuarios();
      setUsuarios(res.data); // Guardo usuarios en estado
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los usuarios.');
    }
  };

  // Al montar, obtengo la lista de usuarios
  useEffect(() => {
    fetchUsuarios();
  }, []);

  // Manejo eliminar un usuario
  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro quieres eliminar este crew?')) return;
    try {
      await eliminarUsuario(id);
      // Quito el usuario eliminado del estado sin recargar todo
      setUsuarios(usuarios.filter(u => u.id !== id));
    } catch (err) {
      console.error(err);
      alert('Error al eliminar');
    }
  };

  return (
    <div style={{ padding: '2rem' }}> {/* Contenedor principal */}
      <h2>Gestión de Crews</h2> {/* Título de la página */}
      {error && <p style={{ color: 'red' }}>{error}</p>} {/* Mensaje de error */}

      {/* Componente para crear un nuevo crew */}
      <NuevoUsuario onNueva={fetchUsuarios} />

      {/* Tabla de usuarios */}
      <table border="1" cellPadding="8" style={{ borderCollapse: 'collapse', marginTop: '1rem' }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Horas Contrato</th>
            <th>Puede cerrar</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map(u => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.nombre}</td>
              <td>{u.correo}</td>
              <td>{u.horas_contrato}</td>
              <td>{u.puede_cerrar ? 'Sí' : 'No'}</td>
              <td>
                {/* Botón para eliminar crew */}
                <button onClick={() => handleDelete(u.id)}>🗑️ Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}