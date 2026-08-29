const express = require('express');
const cors = require('cors');
const { Client } = require('pg');

const app = express();
const port = 3000;

// Middleware
app.use(cors()); // Permite que Angular se conecte
app.use(express.json());

// Configuración de la Base de Datos
const client = new Client({
  user: 'postgres',        //Usuario
  host: 'localhost',
  database: 'PsychoRekords', //Nombre de la base
  password: 'admin',  //Contraseña
  port: 5432,
});

console.log("🔌 Intentando conectar a la base de datos...");

client.connect()
  .then(() => {
    console.log("✅ ¡CONEXIÓN EXITOSA!");
    console.log("La base de datos te respondió. Ya puedes trabajar.");
    
    // Hacemos una consulta simple para confirmar la hora del servidor
    return client.query('SELECT NOW() as hora_actual');
  })
  .then((res) => {
    console.log("⏰ Hora en la base de datos:", res.rows[0].hora_actual);
    client.end(); // Cerramos la conexión
  })
  .catch((err) => {
    console.error("❌ ERROR DE CONEXIÓN:");
    console.error("---------------------");
    if (err.code === '28P01') {
      console.log("--> La contraseña está mal.");
    } else if (err.code === '3D000') {
      console.log("--> La base de datos no existe. Revisa el nombre.");
    } else if (err.code === 'ECONNREFUSED') {
      console.log("--> PostgreSQL parece estar apagado o el puerto no es el 5432.");
    } else {
      console.log(err.message);
    }
    client.end();
  });