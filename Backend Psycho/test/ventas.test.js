const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const dbPath = require.resolve('../src/db');
let consultas = [];
let responder;
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true,
  exports: { query: async (sql, params) => { consultas.push({ sql, params }); return responder(sql, params); } } };
const express = require('express');
const app = express();
app.use('/api/ventas', require('../src/rutas/ventas.rutas'));
const server = app.listen(0);
after(() => server.close());
const pedir = async (ruta, usuario) => {
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/ventas/' + ruta,
    { headers: usuario ? { 'x-user-id': usuario } : {} });
  return { status: response.status, body: await response.json() };
};
const admin = sql => sql.includes('SELECT "rol"');
test('sin sesión no permite listar ni consultar detalles', async () => {
  assert.equal((await pedir('todas')).status, 401);
  assert.equal((await pedir('detalle/1')).status, 401);
});
test('un cliente no puede consultar ventas administrativas', async () => {
  responder = async () => ({ rows: [{ rol: 'cliente' }] });
  assert.equal((await pedir('todas', '1')).status, 403);
  assert.equal((await pedir('detalle/1', '1')).status, 403);
});
test('listado ordenado y total numérico', async () => {
  consultas = [];
  responder = async sql => ({ rows: admin(sql) ? [{rol:'admin'}] : [{idventa:5,totalventa:'550.00'}] });
  const r = await pedir('todas', '2');
  assert.equal(r.status, 200);
  assert.equal(r.body[0].totalventa, 550);
  assert.match(consultas[1].sql, /ORDER BY v.fecha DESC, v.idventa DESC/);
});
test('detalle incluye productos y usa parámetros', async () => {
  consultas = [];
  responder = async sql => ({ rows: admin(sql) ? [{rol:'admin'}] : sql.includes('FROM detalleventa') ? [{iddetalle:1,cantidad:2,precioUnitario:'275.00'}] : [{idventa:5,totalventa:'550.00'}] });
  const r = await pedir('detalle/5', '2');
  assert.equal(r.status, 200);
  assert.equal(r.body.detalles[0].precioUnitario, 275);
  assert.deepEqual(consultas[1].params, [5]);
  assert.match(consultas[2].sql, /dv.cantidad > 0/);
});
test('ID inválido y venta inexistente', async () => {
  responder = async sql => ({ rows: admin(sql) ? [{rol:'admin'}] : [] });
  for (const id of ['abc', '0', '-1', '1.5', '9007199254740992']) {
    assert.equal((await pedir('detalle/' + id, '2')).status, 400);
  }
  assert.equal((await pedir('detalle/999', '2')).status, 404);
});
test('lista vacía y error de base de datos', async () => {
  responder = async sql => ({ rows: admin(sql) ? [{rol:'admin'}] : [] });
  assert.deepEqual((await pedir('todas', '2')).body, []);
  responder = async sql => { if (admin(sql)) return {rows:[{rol:'admin'}]}; throw new Error('BD no disponible'); };
  assert.equal((await pedir('todas', '2')).status, 500);
  assert.equal((await pedir('detalle/1', '2')).status, 500);
});
