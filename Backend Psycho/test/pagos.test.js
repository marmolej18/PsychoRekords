const { test, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

// --- Base de datos simulada: registra cada consulta y responde con `responder` ---
let consultas = [];
let responder = async () => ({ rows: [] });
const query = async (sql, params) => {
  if (sql.includes('FROM token_blocklist')) return { rows: [], rowCount: 0 };
  consultas.push({ sql, params });
  return responder(sql, params);
};
const dbPath = require.resolve('../src/db');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true,
  exports: { query, getClient: async () => ({ query, release: () => {} }) } };

// --- Stripe simulado: null = sin llave configurada ---
let stripeFalso = null;
const stripePath = require.resolve('../src/pagos/stripe');
require.cache[stripePath] = { id: stripePath, filename: stripePath, loaded: true, exports: { stripe: () => stripeFalso } };
const crearStripe = (intent = {}) => {
  const llamadas = { create: [], retrieve: [], refunds: [], cancel: [] };
  return {
    llamadas,
    paymentIntents: {
      create: async (datos, opciones) => { llamadas.create.push({ datos, opciones }); return { id: 'pi_123', client_secret: 'pi_123_secret' }; },
      retrieve: async id => { llamadas.retrieve.push(id); return { id, metadata: { idventa: '7' }, currency: 'mxn', ...intent }; },
      cancel: async id => { llamadas.cancel.push(id); return { id }; }
    },
    refunds: { create: async datos => { llamadas.refunds.push(datos); return {}; } }
  };
};

const express = require('express');
const app = express();
// Igual que server.js: el webhook va antes de express.json para recibir el cuerpo sin parsear.
app.post('/api/pagos/webhook', express.raw({ type: 'application/json' }), require('../src/controladores/pagos.controlador').webhookStripe);
app.use(express.json());
app.use('/api/ventas', require('../src/rutas/ventas.rutas'));
app.use('/api/pagos', require('../src/rutas/pagos.rutas'));
const server = app.listen(0);
after(() => server.close());

const SECRET = process.env.JWT_SECRET || 'secreto_super_seguro_psychorekords';
const pedir = async (metodo, ruta, body, { usuario = 4, rol = 'cliente' } = {}) => {
  const token = jwt.sign({ idUsuario: usuario, rol }, SECRET, { expiresIn: '1h' });
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
};

beforeEach(() => { consultas = []; responder = async () => ({ rows: [] }); stripeFalso = null; });

const compraEnPunto = metodoPago => ({
  metodoPago, idpunto: 2, productos: [{ idprod: 1, cantidad: 2 }],
  envio: { telefono: '4491234567', correo: 'ana@test.com', referencias: 'Playera negra' }
});
// Respuestas de la base para una compra en punto medio de 2 discos de $550.
const baseDeCompra = async sql => {
  if (sql.includes('FROM puntoentrega')) return { rows: [{ nombrepunto: 'UAA', direccioncompleta: 'CU', horarioatencion: '' }] };
  if (sql.includes('SELECT idprod, precio FROM producto')) return { rows: [{ idprod: 1, precio: '550.00' }] };
  if (sql.includes('INSERT INTO "venta"')) return { rows: [{ idventa: 7, fecha: '2026-11-20' }] };
  if (sql.includes('UPDATE "producto"')) return { rows: [{ cantstock: 8 }] };
  return { rows: [] };
};
const columnasInsertadas = () => {
  const insert = consultas.find(c => c.sql.includes('INSERT INTO "venta"'));
  return Object.fromEntries(insert.sql.match(/\(([^)]*)\)/)[1].split(', ').map((c, i) => [c.replace(/"/g, ''), insert.params[i]]));
};

test('método de pago inválido se rechaza sin tocar la base', async () => {
  const r = await pedir('POST', 'ventas', compraEnPunto('bitcoin'));
  assert.equal(r.status, 400);
  assert.equal(consultas.length, 0);
});

test('tarjeta sin llave de Stripe configurada responde 503', async () => {
  const r = await pedir('POST', 'ventas', compraEnPunto('tarjeta'));
  assert.equal(r.status, 503);
  assert.equal(consultas.length, 0);
});

test('PayPal sigue igual: venta pagada y stock descontado al crearla', async () => {
  responder = baseDeCompra;
  const r = await pedir('POST', 'ventas', compraEnPunto('paypal'));
  assert.equal(r.status, 201);
  assert.equal(columnasInsertadas().estadopedido, 'Pagado');
  assert.ok(consultas.some(c => c.sql.includes('UPDATE "producto"')));
});

test('tarjeta: venta pendiente, sin descontar stock y cobro por el total del servidor', async () => {
  stripeFalso = crearStripe();
  responder = baseDeCompra;
  const r = await pedir('POST', 'ventas', compraEnPunto('tarjeta'));
  assert.equal(r.status, 201);
  assert.equal(r.body.clientSecret, 'pi_123_secret');
  assert.equal(r.body.estadopedido, 'Pendiente de pago');
  const venta = columnasInsertadas();
  assert.equal(venta.estadopedido, 'Pendiente de pago');
  assert.equal(venta.metodo_pago, 'tarjeta');
  assert.ok(!consultas.some(c => c.sql.includes('UPDATE "producto"')), 'no debe descontar stock antes del pago');
  // 2 x $550 = $1,100 + 16% IVA = $1,276.00 (punto medio: envío gratis)
  assert.deepEqual(stripeFalso.llamadas.create[0].datos,
    { amount: 127600, currency: 'mxn', payment_method_types: ['card'], metadata: { idventa: '7' } });
  assert.ok(consultas.some(c => c.sql.includes('SET stripe_payment_intent') && c.params[0] === 'pi_123'));
});

test('OXXO: venta pendiente y cobro OXXO con ficha que vence en 3 días', async () => {
  stripeFalso = crearStripe();
  responder = baseDeCompra;
  const r = await pedir('POST', 'ventas', compraEnPunto('oxxo'));
  assert.equal(r.status, 201);
  assert.equal(columnasInsertadas().metodo_pago, 'oxxo');
  assert.equal(columnasInsertadas().estadopedido, 'Pendiente de pago');
  assert.ok(!consultas.some(c => c.sql.includes('UPDATE "producto"')));
  assert.deepEqual(stripeFalso.llamadas.create[0].datos, {
    amount: 127600, currency: 'mxn', payment_method_types: ['oxxo'],
    payment_method_options: { oxxo: { expires_after_days: 3 } }, metadata: { idventa: '7' }
  });
});

test('OXXO: rechaza totales mayores a $10,000 sin crear la venta', async () => {
  stripeFalso = crearStripe();
  responder = async sql => sql.includes('SELECT idprod, precio FROM producto')
    ? { rows: [{ idprod: 1, precio: '9000.00' }] } : baseDeCompra(sql);
  const r = await pedir('POST', 'ventas', compraEnPunto('oxxo'));
  assert.equal(r.status, 400);
  assert.match(r.body.message, /OXXO/);
  assert.ok(!consultas.some(c => c.sql.includes('INSERT INTO "venta"')));
  assert.equal(stripeFalso.llamadas.create.length, 0);
});

test('confirmar OXXO: guarda la ficha y el pedido sigue pendiente', async () => {
  stripeFalso = crearStripe({
    status: 'requires_action', amount_received: 0,
    next_action: { type: 'oxxo_display_details', oxxo_display_details: {
      hosted_voucher_url: 'https://payments.stripe.com/oxxo/voucher/abc', number: '12345678901234567890', expires_after: 1795000000 } }
  });
  responder = baseDePago();
  const r = await pedir('POST', 'pagos/confirmar/7');
  assert.equal(r.status, 202);
  assert.equal(r.body.estadopedido, 'Pendiente de pago');
  assert.equal(r.body.fichaUrl, 'https://payments.stripe.com/oxxo/voucher/abc');
  const guardado = consultas.find(c => c.sql.includes('SET oxxo_ficha_url'));
  assert.deepEqual(guardado.params.slice(0, 2), ['https://payments.stripe.com/oxxo/voucher/abc', '12345678901234567890']);
  assert.equal(guardado.params[2].getTime(), 1795000000 * 1000);
  assert.ok(!consultas.some(c => c.sql.includes('UPDATE producto') || c.sql.includes(`'Pagado'`)));
});

test('si Stripe falla al crear el cobro, la venta se cancela', async () => {
  stripeFalso = crearStripe();
  stripeFalso.paymentIntents.create = async () => { throw new Error('Stripe caído'); };
  responder = baseDeCompra;
  const r = await pedir('POST', 'ventas', compraEnPunto('tarjeta'));
  assert.equal(r.status, 502);
  assert.ok(consultas.some(c => c.sql.includes(`SET estadopedido = 'CANCELADO'`)));
});

// Respuestas de la base al confirmar el pago de la venta 7 ($1,276.00) de 2 unidades del disco 1.
const baseDePago = ({ dueño = 4, estado = 'Pendiente de pago', hayStock = true } = {}) => async sql => {
  if (sql.includes('SELECT idusuario, stripe_payment_intent')) return { rows: [{ idusuario: dueño, stripe_payment_intent: 'pi_123' }] };
  if (sql.includes('FOR UPDATE')) return { rows: [{ estadopedido: estado, totalventa: '1276.00', stripe_payment_intent: 'pi_123' }] };
  if (sql.includes('FROM detalleventa')) return { rows: [{ idprod: 1, cantidad: 2 }] };
  if (sql.includes('UPDATE producto')) return { rows: hayStock ? [{ cantstock: 8 }] : [] };
  return { rows: [] };
};

test('confirmar: solo el dueño de la venta', async () => {
  stripeFalso = crearStripe({ status: 'succeeded', amount_received: 127600 });
  responder = baseDePago({ dueño: 9 });
  assert.equal((await pedir('POST', 'pagos/confirmar/7')).status, 403);
  assert.equal(stripeFalso.llamadas.retrieve.length, 0);
});

test('confirmar: pago exitoso descuenta stock y marca la venta como Pagado', async () => {
  stripeFalso = crearStripe({ status: 'succeeded', amount_received: 127600 });
  responder = baseDePago();
  const r = await pedir('POST', 'pagos/confirmar/7');
  assert.equal(r.status, 200);
  assert.equal(r.body.estadopedido, 'Pagado');
  assert.deepEqual(stripeFalso.llamadas.retrieve, ['pi_123']);
  assert.deepEqual(consultas.find(c => c.sql.includes('UPDATE producto')).params, [2, 1]);
  assert.ok(consultas.some(c => c.sql.includes(`SET estadopedido = 'Pagado'`)));
  assert.ok(consultas.some(c => c.sql === 'COMMIT'));
});

test('confirmar: si Stripe no lo ha cobrado, no cambia nada', async () => {
  stripeFalso = crearStripe({ status: 'requires_payment_method', amount_received: 0 });
  responder = baseDePago();
  const r = await pedir('POST', 'pagos/confirmar/7');
  assert.equal(r.status, 402);
  assert.ok(!consultas.some(c => c.sql.includes('UPDATE producto') || c.sql.includes(`'Pagado'`)));
});

test('confirmar: un monto distinto al total no se acepta', async () => {
  stripeFalso = crearStripe({ status: 'succeeded', amount_received: 100 });
  responder = baseDePago();
  assert.equal((await pedir('POST', 'pagos/confirmar/7')).status, 500);
  assert.ok(!consultas.some(c => c.sql.includes(`SET estadopedido = 'Pagado'`)));
});

test('confirmar dos veces no descuenta el stock dos veces', async () => {
  stripeFalso = crearStripe({ status: 'succeeded', amount_received: 127600 });
  responder = baseDePago({ estado: 'Pagado' });
  const r = await pedir('POST', 'pagos/confirmar/7');
  assert.equal(r.status, 200);
  assert.ok(!consultas.some(c => c.sql.includes('UPDATE producto')));
});

test('confirmar: si ya no hay stock, devuelve el dinero y cancela', async () => {
  stripeFalso = crearStripe({ status: 'succeeded', amount_received: 127600 });
  responder = baseDePago({ hayStock: false });
  const r = await pedir('POST', 'pagos/confirmar/7');
  assert.equal(r.status, 409);
  assert.deepEqual(stripeFalso.llamadas.refunds, [{ payment_intent: 'pi_123' }]);
  assert.ok(consultas.some(c => c.sql.includes(`SET estadopedido = 'CANCELADO'`)));
  assert.ok(!consultas.some(c => c.sql.includes(`SET estadopedido = 'Pagado'`)));
});

// --- Webhook (HU4.4) ---
// Stripe simulado que solo acepta la firma 'firma-valida' y exige el cuerpo crudo (Buffer), como el real.
const conWebhook = stripeBase => {
  stripeBase.webhooks = {
    constructEvent: (cuerpo, firma, secreto) => {
      assert.ok(Buffer.isBuffer(cuerpo), 'el webhook debe recibir el cuerpo sin parsear');
      assert.equal(secreto, 'whsec_prueba');
      if (firma !== 'firma-valida') throw new Error('No signatures found matching the expected signature');
      return JSON.parse(cuerpo.toString());
    }
  };
  return stripeBase;
};
const enviarEvento = async (tipo, intent, firma = 'firma-valida') => {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/pagos/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': firma },
    body: JSON.stringify({ type: tipo, data: { object: { id: 'pi_123', metadata: { idventa: '7' }, currency: 'mxn', ...intent } } })
  });
  return { status: response.status, body: await response.json() };
};

test('webhook: sin secreto configurado responde 503', async () => {
  delete process.env.STRIPE_WEBHOOK_SECRET;
  stripeFalso = conWebhook(crearStripe());
  assert.equal((await enviarEvento('payment_intent.succeeded', {})).status, 503);
});

test('webhook: una firma inválida se rechaza sin tocar la base', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_prueba';
  stripeFalso = conWebhook(crearStripe());
  const r = await enviarEvento('payment_intent.succeeded', { status: 'succeeded', amount_received: 127600 }, 'firma-falsa');
  assert.equal(r.status, 400);
  assert.equal(consultas.length, 0);
});

test('webhook: pago completado descuenta stock y marca Pagado (OXXO pagado en tienda)', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_prueba';
  stripeFalso = conWebhook(crearStripe());
  responder = baseDePago();
  const r = await enviarEvento('payment_intent.succeeded', { status: 'succeeded', amount_received: 127600, payment_method_types: ['oxxo'] });
  assert.equal(r.status, 200);
  assert.deepEqual(consultas.find(c => c.sql.includes('UPDATE producto')).params, [2, 1]);
  assert.ok(consultas.some(c => c.sql.includes(`SET estadopedido = 'Pagado'`)));
});

test('webhook: el mismo aviso repetido no descuenta stock dos veces', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_prueba';
  stripeFalso = conWebhook(crearStripe());
  responder = baseDePago({ estado: 'Pagado' });
  assert.equal((await enviarEvento('payment_intent.succeeded', { status: 'succeeded', amount_received: 127600 })).status, 200);
  assert.ok(!consultas.some(c => c.sql.includes('UPDATE producto')));
});

test('webhook: pago completado sin stock devuelve el dinero y cancela', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_prueba';
  stripeFalso = conWebhook(crearStripe());
  responder = baseDePago({ hayStock: false });
  assert.equal((await enviarEvento('payment_intent.succeeded', { status: 'succeeded', amount_received: 127600 })).status, 200);
  assert.deepEqual(stripeFalso.llamadas.refunds, [{ payment_intent: 'pi_123' }]);
  assert.ok(consultas.some(c => c.sql.includes(`SET estadopedido = 'CANCELADO'`)));
});

test('webhook: ficha de OXXO generada se guarda aunque el cliente cierre la página', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_prueba';
  stripeFalso = conWebhook(crearStripe());
  const r = await enviarEvento('payment_intent.requires_action', {
    status: 'requires_action',
    next_action: { type: 'oxxo_display_details', oxxo_display_details: { hosted_voucher_url: 'https://ficha', number: '999', expires_after: 1795000000 } }
  });
  assert.equal(r.status, 200);
  assert.deepEqual(consultas.find(c => c.sql.includes('SET oxxo_ficha_url')).params.slice(0, 2), ['https://ficha', '999']);
});

test('webhook: ficha de OXXO vencida cancela el pedido; tarjeta rechazada no', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_prueba';
  stripeFalso = conWebhook(crearStripe());
  await enviarEvento('payment_intent.payment_failed', { status: 'requires_payment_method', payment_method_types: ['card'] });
  assert.ok(!consultas.some(c => c.sql.includes('CANCELADO')), 'una tarjeta rechazada puede reintentarse');

  await enviarEvento('payment_intent.payment_failed', { status: 'requires_payment_method', payment_method_types: ['oxxo'] });
  const cancelacion = consultas.find(c => c.sql.includes(`SET estadopedido = 'CANCELADO'`));
  assert.deepEqual(cancelacion.params, ['pi_123', 'Pendiente de pago']);
  assert.ok(!consultas.some(c => c.sql.includes('sp_cancelar_venta') || c.sql.includes('UPDATE producto')));
});

test('webhook: un cobro cancelado cancela el pedido pendiente', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_prueba';
  stripeFalso = conWebhook(crearStripe());
  assert.equal((await enviarEvento('payment_intent.canceled', { status: 'canceled' })).status, 200);
  assert.ok(consultas.some(c => c.sql.includes(`SET estadopedido = 'CANCELADO'`)));
});

test('webhook: valida la firma con la librería real de Stripe', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_prueba';
  const real = new (require('stripe'))('sk_test_falsa_solo_para_firmar');
  stripeFalso = crearStripe();
  stripeFalso.webhooks = real.webhooks;
  const cuerpo = JSON.stringify({ type: 'payment_intent.canceled', data: { object: { id: 'pi_123', status: 'canceled', metadata: { idventa: '7' } } } });
  const enviar = firma => fetch(`http://127.0.0.1:${server.address().port}/api/pagos/webhook`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': firma }, body: cuerpo
  });

  const valida = real.webhooks.generateTestHeaderString({ payload: cuerpo, secret: 'whsec_prueba' });
  assert.equal((await enviar(valida)).status, 200);
  assert.ok(consultas.some(c => c.sql.includes(`SET estadopedido = 'CANCELADO'`)));

  consultas = [];
  const conOtroSecreto = real.webhooks.generateTestHeaderString({ payload: cuerpo, secret: 'whsec_de_un_atacante' });
  assert.equal((await enviar(conOtroSecreto)).status, 400);
  assert.equal(consultas.length, 0);
});

test('webhook: ignora pagos que no son de la tienda (sin número de venta)', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_prueba';
  stripeFalso = conWebhook(crearStripe());
  const r = await enviarEvento('payment_intent.succeeded', { status: 'succeeded', amount_received: 2000, metadata: {} });
  assert.equal(r.status, 200);
  assert.equal(r.body.ignorado, true);
  assert.equal(consultas.length, 0);
});

test('webhook: si falla la base responde 500 para que Stripe reintente', async () => {
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_prueba';
  stripeFalso = conWebhook(crearStripe());
  responder = async () => { throw new Error('BD caída'); };
  assert.equal((await enviarEvento('payment_intent.canceled', { status: 'canceled' })).status, 500);
});

test('cancelar una venta pendiente cancela el cobro y no regresa stock', async () => {
  stripeFalso = crearStripe();
  responder = async sql => sql.includes('SELECT estadopedido, stripe_payment_intent')
    ? { rows: [{ estadopedido: 'Pendiente de pago', stripe_payment_intent: 'pi_123' }] } : { rows: [] };
  const r = await pedir('PUT', 'ventas/cancelar/7', {}, { usuario: 1, rol: 'admin' });
  assert.equal(r.status, 200);
  assert.deepEqual(stripeFalso.llamadas.cancel, ['pi_123']);
  assert.ok(!consultas.some(c => c.sql.includes('sp_cancelar_venta')));
});
