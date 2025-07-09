const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

pool.query('SELECT current_database()', (err, res) => {
  if (err) {
    console.error('❌ Error al obtener el nombre de la base de datos:', err);
  } else {
    console.log('📦 Base de datos conectada:', res.rows[0].current_database);
  }
});

// Probar conexión
pool.connect()
  .then(client => {
    return client
      .query('SELECT NOW()')
      .then(res => {
        console.log('✅ Conexión exitosa a PostgreSQL. Fecha actual del servidor:', res.rows[0].now);
        client.release();
      })
      .catch(err => {
        client.release();
        console.error('❌ Error ejecutando consulta:', err.stack);
      });
  })
  .catch(err => {
    console.error('❌ Error conectando a la base de datos:', err.stack);
  });

module.exports = pool;