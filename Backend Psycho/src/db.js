const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

// Configuración del pool de conexión
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'PsychoRekords',
    password: process.env.DB_PASSWORD || 'admin',
    port: Number(process.env.DB_PORT) || 5432,
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
