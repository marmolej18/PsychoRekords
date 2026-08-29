const { Pool } = require('pg');


// Configuración del pool de conexión
const pool = new Pool({
    user: 'postgres',        //Usuario
    host: 'localhost',
    database: 'PsychoRekords', //Nombre de la base
    password: 'admin',  //Contraseña
    port: 5432,
});

// Prueba de conexión (opcional)
pool.on('connect', () => {
    console.log('Cliente conectado a PostgreSQL.');
});

// Exporta el pool para que otros módulos puedan hacer queries
module.exports = {
    query: (text, params) => pool.query(text, params),
    getClient: () => pool.connect(), // Para transacciones
};