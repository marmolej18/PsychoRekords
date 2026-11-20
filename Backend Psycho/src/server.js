const express = require('express');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Configuración de CORS permitiendo Authorization
app.use(cors({
    origin: 'http://localhost:4200',
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// El webhook de Stripe va ANTES de express.json: necesita el cuerpo sin parsear para validar la firma.
app.post('/api/pagos/webhook', express.raw({ type: 'application/json', limit: '1mb' }),
    require('./controladores/pagos.controlador').webhookStripe);

app.use(express.json({ limit: '32kb' }));

// Importar rutas
const productosRouter = require('./rutas/productos.rutas');
const ventasRouter = require('./rutas/ventas.rutas');
const usuariosRouter = require('./rutas/usuarios.rutas');
const puntosRouter = require('./rutas/puntosEntrega.rutas');
const reportesRouter = require('./rutas/reportes.rutas');
const tarifasEnvioRouter = require('./rutas/tarifasEnvio.rutas');
const pagosRouter = require('./rutas/pagos.rutas');

// RUTAS PRINCIPALES
app.use('/api/productos', productosRouter);
app.use('/api/ventas', ventasRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/puntos-entrega', puntosRouter);
app.use('/api/reportes', reportesRouter);
app.use('/api/tarifas-envio', tarifasEnvioRouter);
app.use('/api/pagos', pagosRouter);

app.get('/', (req, res) => {
    res.send('API de PsychoRecords funcionando.');
});

require('./seguridad/migrar').migrar().then(() => {
    console.log('Conexión a PostgreSQL lista.');
    app.listen(PORT, () => console.log(`Servidor Node.js corriendo en http://localhost:${PORT}`));
}).catch(error => { console.error('No se pudo preparar la seguridad de la base:', error.message); process.exitCode = 1; });