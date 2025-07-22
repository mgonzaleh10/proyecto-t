import { render, screen } from '@testing-library/react'; // Importo funciones de testing
import App from './App'; // Importo el componente principal

// Escribo un test que verifica que aparezca un texto esperado
test('renders learn react link', () => {
  render(<App />); // Renderizo el componente App
  const linkElement = screen.getByText(/learn react/i); // Busco texto ignorando mayúsculas
  expect(linkElement).toBeInTheDocument(); // Espero que esté en el documento
});