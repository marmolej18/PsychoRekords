const path = require('path');
const { Pool } = require('pg');
// quiet: dotenv 17 imprime un aviso con "tips" cada vez que carga el .env
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });

// Configuración del pool de conexión
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'PsychoRekords',
    password: process.env.DB_PASSWORD || 'admin',
    port: Number(process.env.DB_PORT) || 5432,
});

// El pool abre y cierra conexiones solo (cierra las inactivas tras 10 s), así que no se registra
// cada conexión: server.js avisa una sola vez, al arrancar, que la base está lista.
// Un error en una conexión inactiva (p. ej., si PostgreSQL se reinicia) no debe tumbar el servidor.
pool.on('error', (error) => {
    console.error('Error en una conexión inactiva de PostgreSQL:', error.message);
});

// Exporta el pool para que otros módulos puedan hacer queries
module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(), // Para transacciones
};
