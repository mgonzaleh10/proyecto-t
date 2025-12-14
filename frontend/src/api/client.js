import axios from 'axios'; // Importo axios para comunicarme con el backend

// Tomamos la URL desde variable de entorno (React solo lee las que empiezan con REACT_APP_)
const API_BASE_URL = process.env.REACT_APP_API_URL || '146.83.198.35:1549';

const client = axios.create({
  baseURL: API_BASE_URL,
});

export default client; // Exporto el cliente configurado