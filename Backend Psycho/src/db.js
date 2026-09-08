const { Pool } = require('pg');
require('dotenv').config();

// Configuración del pool de conexión
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Prueba de conexión 
pool.on('connect', () => {
    console.log('Cliente conectado a PostgreSQL.');
});

// Exporta el pool para que otros módulos puedan hacer queries
module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(), // Para transacciones
};