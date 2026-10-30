const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Configuración de CORS permitiendo Authorization
app.use(cors({
    origin: 'http://localhost:4200',
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Importar rutas
const productosRouter = require('./rutas/productos.rutas');
const ventasRouter = require('./rutas/ventas.rutas');
const usuariosRouter = require('./rutas/usuarios.rutas');
const puntosRouter = require('./rutas/puntosEntrega.rutas');
const reportesRouter = require('./rutas/reportes.rutas');

// RUTAS PRINCIPALES
app.use('/api/productos', productosRouter);
app.use('/api/ventas', ventasRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/puntos-entrega', puntosRouter);
app.use('/api/reportes', reportesRouter);

app.get('/', (req, res) => {
    res.send('API de PsychoRecords funcionando.');
});

app.listen(PORT, () => {
    console.log(`Servidor Node.js corriendo en http://localhost:${PORT}`);
});