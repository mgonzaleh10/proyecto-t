const express = require('express'); // Importo Express para crear el servidor
const cors = require('cors'); // Importo CORS para manejar orígenes cruzados
const app = express(); // Creo la instancia de Express

const disponibilidadRoutes = require('./routes/disponibilidades.routes'); // Importo mis rutas de disponibilidades
const usuariosRoutes      = require('./routes/usuarios.routes');        // Importo mis rutas de usuarios
const beneficiosRoutes    = require('./routes/beneficios.routes');      // Importo mis rutas de beneficios
const turnosRoutes        = require('./routes/turnos.routes');          // Importo mis rutas de turnos

const db = require('./config/db'); // Importo la configuración de la BD

app.use(express.json()); // Habilito el parseo de JSON en las peticiones
app.use(cors());         // Habilito CORS para permitir solicitudes desde otros orígenes

// Registro las rutas de mi API
app.use('/usuarios', usuariosRoutes);           // Configuro ruta /usuarios
app.use('/disponibilidades', disponibilidadRoutes); // Configuro ruta /disponibilidades
app.use('/beneficios', beneficiosRoutes);       // Configuro ruta /beneficios
app.use('/turnos', turnosRoutes);               // Configuro ruta /turnos

const PORT = process.env.PORT || 3000; // Defino el puerto del servidor
app.listen(PORT, async () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`); // Inicio el servidor

  try {
    // Verifico la conexión a PostgreSQL al iniciar
    const result = await db.query('SELECT NOW()');
    console.log(`✅ Conexión a PostgreSQL OK. Fecha: ${result.rows[0].now}`);
  } catch (error) {
    console.error('❌ Error al conectar con PostgreSQL:', error); // Muestro el error si no conecta
  }
});