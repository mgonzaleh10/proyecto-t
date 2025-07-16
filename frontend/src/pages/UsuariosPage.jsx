import React, { useEffect, useState } from 'react';
import { getUsuarios, eliminarUsuario } from '../api/usuarios';
import NuevoUsuario from './NuevoUsuario';

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState([]);
  const [error, setError] = useState(null);

  const fetchUsuarios = async () => {
    try {
      const res = await getUsuarios();
      setUsuarios(res.data);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los usuarios.');
    }
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('¿Seguro quieres eliminar este crew?')) return;
    try {
      await eliminarUsuario(id);
      setUsuarios(usuarios.filter(u => u.id !== id));
    } catch (err) {
      console.error(err);
      alert('Error al eliminar');
    }
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>Gestión de Crews</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <NuevoUsuario onNueva={fetchUsuarios} />
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
                <button onClick={() => handleDelete(u.id)}>🗑️ Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}