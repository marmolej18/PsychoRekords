const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const dbPath = require.resolve('../src/db');
let consultas = [];
let responder;
let blocklistFalla = false;
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true,
  exports: { query: async (sql, params) => {
    if (sql.includes('FROM token_blocklist')) {
      if (blocklistFalla) throw new Error('no existe la relación «token_blocklist»');
      return { rows: [], rowCount: 0 };
    }
    consultas.push({ sql, params });
    return responder(sql, params);
  } } };
const express = require('express');
const app = express();
app.use(express.json());
app.use('/api/ventas', require('../src/rutas/ventas.rutas'));
const server = app.listen(0);
after(() => server.close());

const SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_psychorekords';
const crearToken = (idUsuario, rol) => jwt.sign({ idUsuario: Number(idUsuario), rol }, SECRET, { expiresIn: '1h' });

const pedir = async (ruta, usuario, rol = 'admin', body) => {
  const token = usuario ? crearToken(usuario, rol) : null;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const opciones = body === undefined ? { headers }
    : { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/ventas/' + ruta, opciones);
  return { status: response.status, body: await response.json() };
};

test('sin sesión no permite listar ni consultar detalles', async () => {
  assert.equal((await pedir('todas')).status, 401);
  assert.equal((await pedir('detalle/1')).status, 401);
});
test('un cliente no puede consultar ventas administrativas', async () => {
  assert.equal((await pedir('todas', '1', 'cliente')).status, 403);
  assert.equal((await pedir('detalle/1', '1', 'cliente')).status, 403);
});
test('listado ordenado y total numérico', async () => {
  consultas = [];
  responder = async () => ({ rows: [{idventa:5,totalventa:'550.00'}] });
  const r = await pedir('todas', '2', 'admin');
  assert.equal(r.status, 200);
  assert.equal(r.body[0].totalventa, 550);
  assert.match(consultas[0].sql, /ORDER BY v.fecha DESC, v.idventa DESC/);
});
test('listado filtra por orden y rango de fechas con parámetros', async () => {
  responder = async () => ({ rows: [] });
  consultas = [];
  assert.equal((await pedir('todas?idventa=5', '2', 'admin')).status, 200);
  assert.match(consultas[0].sql, /WHERE v.idventa = \$1 ORDER BY/);
  assert.deepEqual(consultas[0].params, [5]);
  consultas = [];
  assert.equal((await pedir('todas?desde=2026-10-01&hasta=2026-10-31', '2', 'admin')).status, 200);
  assert.match(consultas[0].sql, /v.fecha >= \$1::date AND v.fecha < \$2::date \+ 1/);
  assert.deepEqual(consultas[0].params, ['2026-10-01', '2026-10-31']);
  consultas = [];
  assert.equal((await pedir('todas', '2', 'admin')).status, 200);
  assert.doesNotMatch(consultas[0].sql, /WHERE v\./);
  assert.deepEqual(consultas[0].params, []);
});
test('listado rechaza filtros inválidos sin consultar la BD', async () => {
  consultas = [];
  for (const q of ['idventa=abc', 'idventa=0', 'idventa=1.5', 'desde=ayer', 'hasta=2026-02-30',
    'desde=2026-10-31&hasta=2026-10-01']) {
    assert.equal((await pedir('todas?' + q, '2', 'admin')).status, 400, q);
  }
  assert.equal(consultas.length, 0);
});
test('detalle incluye productos y usa parámetros', async () => {
  consultas = [];
  responder = async sql => ({ rows: sql.includes('FROM detalleventa') ? [{iddetalle:1,cantidad:2,precioUnitario:'275.00'}] : [{idventa:5,totalventa:'550.00'}] });
  const r = await pedir('detalle/5', '2', 'admin');
  assert.equal(r.status, 200);
  assert.equal(r.body.detalles[0].precioUnitario, 275);
  assert.deepEqual(consultas[0].params, [5]);
  assert.match(consultas[1].sql, /dv.cantidad > 0/);
});
test('ID inválido y venta inexistente', async () => {
  responder = async () => ({ rows: [] });
  for (const id of ['abc', '0', '-1', '1.5', '9007199254740992']) {
    assert.equal((await pedir('detalle/' + id, '2', 'admin')).status, 400);
  }
  assert.equal((await pedir('detalle/999', '2', 'admin')).status, 404);
});
test('mis-pedidos usa el usuario del token y omite ajustes de cancelación', async () => {
  assert.equal((await pedir('mis-pedidos')).status, 401);
  consultas = [];
  responder = async () => ({ rows: [{idventa:7,totalventa:'300.00',detalles:[{iddetalle:1,cantidad:1,precioUnitario:'300.00'}]}] });
  const r = await pedir('mis-pedidos', '4', 'cliente');
  assert.equal(r.status, 200);
  assert.deepEqual(consultas[0].params, [4]);
  assert.match(consultas[0].sql, /dv.cantidad > 0/);
  assert.equal(r.body[0].totalventa, 300);
  assert.equal(r.body[0].detalles[0].precioUnitario, 300);
  responder = async () => ({ rows: [] });
  assert.deepEqual((await pedir('mis-pedidos', '4', 'cliente')).body, []);
  responder = async () => { throw new Error('BD no disponible'); };
  assert.equal((await pedir('mis-pedidos', '4', 'cliente')).status, 500);
});
test('un fallo de la BD al validar la sesión responde 500, no 403', async () => {
  blocklistFalla = true;
  try {
    assert.equal((await pedir('mis-pedidos', '4', 'cliente')).status, 500);
  } finally {
    blocklistFalla = false;
  }
});
test('un cliente no puede ver el historial de otro usuario', async () => {
  responder = async () => ({ rows: [] });
  assert.equal((await pedir('usuario/9', '4', 'cliente')).status, 403);
  assert.equal((await pedir('usuario/4', '4', 'cliente')).status, 200);
  assert.equal((await pedir('usuario/9', '2', 'admin')).status, 200);
});
test('solo el admin puede avanzar el estado de un pedido', async () => {
  assert.equal((await pedir('estado/5', null, 'admin', { estado: 'Entregado' })).status, 401);
  assert.equal((await pedir('estado/5', '4', 'cliente', { estado: 'Entregado' })).status, 403);
});
test('avanzar estado valida id y etapa destino', async () => {
  consultas = [];
  for (const estado of [undefined, 'Pagado', 'CANCELADO', 'Enviado']) {
    assert.equal((await pedir('estado/5', '2', 'admin', { estado })).status, 400);
  }
  assert.equal((await pedir('estado/abc', '2', 'admin', { estado: 'Entregado' })).status, 400);
  assert.equal(consultas.length, 0);
});
test('avanza solo desde la etapa inmediata anterior', async () => {
  consultas = [];
  responder = async () => ({ rows: [{ idventa: 5, estadopedido: 'En preparación' }] });
  const r = await pedir('estado/5', '2', 'admin', { estado: 'En preparación' });
  assert.equal(r.status, 200);
  assert.equal(r.body.estadopedido, 'En preparación');
  assert.deepEqual(consultas[0].params, ['En preparación', 5, 'Pagado', null, null]);
});
test('pasar a "En tránsito" exige paquetería y guía válidas', async () => {
  consultas = [];
  for (const body of [{}, { paqueteria: 'FedEx', numeroGuia: '1234567890' },
    { paqueteria: 'DHL' }, { paqueteria: 'DHL', numeroGuia: '12' }, { paqueteria: 'DHL', numeroGuia: 'guía con espacios' }]) {
    assert.equal((await pedir('estado/5', '2', 'admin', { estado: 'En tránsito', ...body })).status, 400, JSON.stringify(body));
  }
  assert.equal(consultas.length, 0);
  responder = async () => ({ rows: [{ idventa: 5, estadopedido: 'En tránsito', paqueteria: 'DHL', numero_guia: 'AB12345678' }] });
  const r = await pedir('estado/5', '2', 'admin', { estado: 'En tránsito', paqueteria: 'DHL', numeroGuia: ' ab12345678 ' });
  assert.equal(r.status, 200);
  assert.equal(r.body.numero_guia, 'AB12345678');
  assert.deepEqual(consultas[0].params, ['En tránsito', 5, 'En preparación', 'DHL', 'AB12345678']);
});
test('rechaza saltos de etapa y ventas inexistentes', async () => {
  responder = async sql => ({ rows: sql.startsWith('SELECT') ? [{ estadopedido: 'Pagado' }] : [] });
  const salto = await pedir('estado/5', '2', 'admin', { estado: 'Entregado' });
  assert.equal(salto.status, 409);
  assert.match(salto.body.message, /Pagado/);
  responder = async () => ({ rows: [] });
  assert.equal((await pedir('estado/999', '2', 'admin', { estado: 'Entregado' })).status, 404);
  responder = async () => { throw new Error('BD no disponible'); };
  assert.equal((await pedir('estado/5', '2', 'admin', { estado: 'Entregado' })).status, 500);
});
test('cancelar: solo admin y nunca un pedido entregado ni en tránsito', async () => {
  assert.equal((await pedir('cancelar/5', '4', 'cliente', {})).status, 403);
  consultas = [];
  responder = async () => ({ rows: [{ estadopedido: 'Entregado' }] });
  const r = await pedir('cancelar/5', '2', 'admin', {});
  assert.equal(r.status, 409);
  assert.match(r.body.message, /ya fue entregado/);
  responder = async () => ({ rows: [{ estadopedido: 'En tránsito' }] });
  const enCamino = await pedir('cancelar/5', '2', 'admin', {});
  assert.equal(enCamino.status, 409);
  assert.match(enCamino.body.message, /ya va en camino/);
  assert.ok(!consultas.some(c => c.sql.includes('sp_cancelar_venta')));
});
test('crear venta exige una dirección de envío válida antes de tocar la BD', async () => {
  const valida = { destinatario: 'Juan Pérez', telefono: '449 123 4567', calle: 'Av. Madero', numero: '123',
    colonia: 'Centro', cp: '20000', ciudad: 'Aguascalientes', estado: 'Aguascalientes' };
  const crear = async envio => {
    const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/ventas/', {
      method: 'POST',
      headers: { Authorization: `Bearer ${crearToken(4, 'cliente')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ idusuario: 4, productos: [{ idprod: 1, cantidad: 1, precioUnitario: 550 }], envio })
    });
    return { status: response.status, body: await response.json() };
  };
  consultas = [];
  for (const envio of [undefined, { ...valida, calle: '  ' }, { ...valida, cp: '2000' },
    { ...valida, telefono: '12345' }, { ...valida, referencias: 'x'.repeat(301) }]) {
    assert.equal((await crear(envio)).status, 400, JSON.stringify(envio));
  }
  assert.match((await crear({ ...valida, cp: 'abcde' })).body.message, /código postal/);
  assert.equal(consultas.length, 0);
});
test('cancelar llama al procedimiento y devuelve su motivo de error', async () => {
  consultas = [];
  responder = async sql => ({ rows: sql.startsWith('SELECT') ? [{ estadopedido: 'Pagado' }] : [] });
  assert.equal((await pedir('cancelar/5', '2', 'admin', {})).status, 200);
  assert.deepEqual(consultas[1].params, [5, 2]);
  responder = async sql => {
    if (sql.startsWith('SELECT')) return { rows: [{ estadopedido: 'CANCELADO' }] };
    throw new Error('Falló la cancelación de la venta 5: ERROR: Venta 5 ya ha sido cancelada.');
  };
  const r = await pedir('cancelar/5', '2', 'admin', {});
  assert.equal(r.status, 400);
  assert.equal(r.body.message, 'Venta 5 ya ha sido cancelada.');
});
test('lista vacía y error de base de datos', async () => {
  responder = async () => ({ rows: [] });
  assert.deepEqual((await pedir('todas', '2', 'admin')).body, []);
  responder = async () => { throw new Error('BD no disponible'); };
  assert.equal((await pedir('todas', '2', 'admin')).status, 500);
  assert.equal((await pedir('detalle/1', '2', 'admin')).status, 500);
});
