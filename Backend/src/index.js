const express = require('express');
const cors = require('cors');
const app = express();
const disponibilidadRoutes = require('./routes/disponibilidades.routes');
const usuariosRoutes = require('./routes/usuarios.routes');
const beneficiosRoutes = require('./routes/beneficios.routes');
const turnosRoutes = require('./routes/turnos.routes');
const db = require('./config/db');

app.use(express.json());
app.use(cors());

app.use('/usuarios', usuariosRoutes);
app.use('/disponibilidades', disponibilidadRoutes);
app.use('/beneficios', beneficiosRoutes);
app.use('/turnos', turnosRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
  try {
    const result = await db.query('SELECT NOW()');
    console.log(`✅ Conexión a PostgreSQL OK. Fecha: ${result.rows[0].now}`);
  } catch (error) {
    console.error('❌ Error al conectar con PostgreSQL:', error);
  }
});