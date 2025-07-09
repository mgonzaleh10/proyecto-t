import axios from 'axios';

const client = axios.create({
  baseURL: 'http://localhost:3001'   // ajusta si tu backend corre en otro puerto
});

export default client;