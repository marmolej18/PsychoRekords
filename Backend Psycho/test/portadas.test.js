const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// --- Base de datos simulada ---
let consultas = [];
let responder = async () => ({ rows: [] });
const query = async (sql, params) => {
  if (sql.includes('FROM token_blocklist')) return { rows: [], rowCount: 0 };
  consultas.push({ sql, params });
  return responder(sql, params);
};
const dbPath = require.resolve('../src/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { query, getClient: async () => ({ query, release: () => {} }) } };

const { CARPETA_UPLOADS } = require('../src/almacenamiento/portadas');
const express = require('express');
const app = express();
app.use(express.json());
app.use('/api/productos', require('../src/rutas/productos.rutas'));
app.use('/uploads', express.static(CARPETA_UPLOADS, { index: false }));
const server = app.listen(0);

// Las portadas que se creen en las pruebas se borran al final.
const creadas = [];
after(() => {
  server.close();
  for (const url of creadas) fs.rmSync(path.join(CARPETA_UPLOADS, url.replace('/uploads/', '')), { force: true });
});
beforeEach(() => { consultas = []; responder = async () => ({ rows: [] }); });

const SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_psychorekords';
const subir = async (archivo, { rol = 'admin', nombre = 'portada.jpg', tipo = 'image/jpeg' } = {}) => {
  const formulario = new FormData();
  if (archivo) formulario.append('imagen', new Blob([archivo], { type: tipo }), nombre);
  const token = jwt.sign({ idUsuario: 1, rol }, SECRET, { expiresIn: '1h' });
  const r = await fetch(`http://127.0.0.1:${server.address().port}/api/productos/5/imagen`, {
    method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: formulario
  });
  return { status: r.status, body: await r.json() };
};

const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100, 1)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(100, 1)]);
const productoExistente = (imagenAnterior = null) => async sql => {
  if (sql.startsWith('SELECT imagen_url')) return { rows: [{ imagen_url: imagenAnterior }] };
  if (sql.startsWith('UPDATE producto')) return { rows: [{ idprod: 5, imagen_url: consultas.at(-1).params[0] }] };
  return { rows: [] };
};

test('solo el admin puede subir portadas', async () => {
  assert.equal((await subir(JPG, { rol: 'cliente' })).status, 403);
  assert.equal(consultas.length, 0);
});

test('sin archivo responde 400', async () => {
  assert.equal((await subir(null)).status, 400);
});

test('rechaza archivos que no son imagen aunque digan .jpg', async () => {
  const r = await subir(Buffer.from('<script>alert(1)</script>'), { nombre: 'virus.jpg', tipo: 'image/jpeg' });
  assert.equal(r.status, 400);
  assert.match(r.body.message, /JPG, PNG o WEBP/);
  assert.equal(consultas.length, 0);
});

test('rechaza imágenes de más de 2 MB', async () => {
  const grande = Buffer.concat([JPG, Buffer.alloc(2 * 1024 * 1024, 1)]);
  const r = await subir(grande);
  assert.equal(r.status, 413);
  assert.equal(consultas.length, 0);
});

test('producto inexistente responde 404 sin guardar archivo', async () => {
  responder = async () => ({ rows: [] });
  assert.equal((await subir(JPG)).status, 404);
  assert.ok(!consultas.some(c => c.sql.startsWith('UPDATE')));
});

test('guarda la portada con nombre aleatorio y extensión real, y se puede ver', async () => {
  responder = productoExistente();
  const r = await subir(PNG, { nombre: 'mi portada.jpg' }); // el nombre dice jpg, el contenido es png
  assert.equal(r.status, 200);
  const url = r.body.producto.imagen_url;
  creadas.push(url);
  assert.match(url, /^\/uploads\/portadas\/[0-9a-f-]{36}\.png$/);
  const archivo = await fetch(`http://127.0.0.1:${server.address().port}${url}`);
  assert.equal(archivo.status, 200);
  assert.deepEqual(Buffer.from(await archivo.arrayBuffer()), PNG);
});

test('al reemplazar la portada borra la anterior', async () => {
  responder = productoExistente();
  const primera = (await subir(JPG)).body.producto.imagen_url;
  responder = productoExistente(primera);
  const segunda = (await subir(PNG)).body.producto.imagen_url;
  creadas.push(segunda);
  assert.notEqual(primera, segunda);
  assert.ok(!fs.existsSync(path.join(CARPETA_UPLOADS, primera.replace('/uploads/', ''))), 'la portada anterior debe borrarse');
  assert.ok(fs.existsSync(path.join(CARPETA_UPLOADS, segunda.replace('/uploads/', ''))));
});
