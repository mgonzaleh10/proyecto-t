// Importación del cliente Pool de PostgreSQL
const { Pool } = require('pg');

// Carga variables de entorno desde el archivo .env
require('dotenv').config();

// Configuración de la conexión a la base de datos
const pool = new Pool({
  user: process.env.DB_USER,         // Usuario de la BD
  host: process.env.DB_HOST,         // Host de la BD
  database: process.env.DB_NAME,     // Nombre de la BD
  password: process.env.DB_PASSWORD, // Contraseña de la BD
  port: process.env.DB_PORT          // Puerto de conexión
});

// Verificación inicial de la conexión
pool.query('SELECT current_database()', (err, res) => {
  if (err) {
    console.error('❌ Error al obtener el nombre de la base de datos:', err); // Manejo de errores
  } else {
    console.log('📦 Base de datos conectada:', res.rows[0].current_database);  // Confirmación de conexión
  }
});

// Exporta el pool para usarlo en otros módulos
module.exports = pool;