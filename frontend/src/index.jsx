import React from 'react'; // Importo React
import ReactDOM from 'react-dom/client'; // Importo el renderizador moderno
import { BrowserRouter } from 'react-router-dom'; // Importo el enrutador
import App from './App'; // Importo el componente principal
import './index.css'; // Importo los estilos globales

// Obtengo el contenedor root y creo la raíz de React
const container = document.getElementById('root');
const root = ReactDOM.createRoot(container);

// Renderizo la aplicación dentro de BrowserRouter para habilitar rutas
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);