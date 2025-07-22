import axios from 'axios'; // Importo axios para comunicarme con el backend

// Creo instancia de axios con la URL base de mi API
const client = axios.create({
  baseURL: 'http://localhost:3000'   // ajusto si mi backend corre en otro puerto
});

export default client; // Exporto el cliente configurado