import axios from 'axios';

// En Docker/producción usamos /api (Nginx lo redirige al backend).
// En desarrollo local puedes setear REACT_APP_API_URL=http://localhost:3000
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const client = axios.create({
  baseURL: API_BASE_URL,
});

export default client;
