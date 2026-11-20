const db = require('../db');
const { stripe } = require('../pagos/stripe');

const PENDIENTE = 'Pendiente de pago';

/**
 * Aplica un pago que Stripe reporta: si la venta sigue pendiente y el cobro coincide con su total,
 * descuenta el stock y la marca como 'Pagado', todo en una transacción. Es idempotente: si la venta
 * ya no está pendiente (por ejemplo, porque llega dos veces la misma confirmación) no hace nada.
 * Devuelve { estado } o { sinStock: true } si ya no alcanza el inventario.
 */
async function aplicarPago(intent) {
    const idventa = Number(intent?.metadata?.idventa);
    if (!Number.isSafeInteger(idventa) || idventa <= 0) throw new Error('El pago no indica a qué venta pertenece.');

    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        const venta = await client.query(
            'SELECT estadopedido, totalventa, stripe_payment_intent FROM venta WHERE idventa = $1 FOR UPDATE', [idventa]);
        if (!venta.rows.length) throw new Error(`La venta ${idventa} no existe.`);
        const { estadopedido, totalventa, stripe_payment_intent } = venta.rows[0];
        if (stripe_payment_intent !== intent.id) throw new Error(`El pago no corresponde a la venta ${idventa}.`);

        if (estadopedido !== PENDIENTE || intent.status !== 'succeeded') {
            await client.query('ROLLBACK');
            return { estado: estadopedido };
        }
        if (intent.currency !== 'mxn' || intent.amount_received !== Math.round(Number(totalventa) * 100)) {
            throw new Error(`El monto cobrado no coincide con el total de la venta ${idventa}.`);
        }

        const detalles = await client.query(
            'SELECT idprod, cantidad FROM detalleventa WHERE idventa = $1 AND cantidad > 0 ORDER BY idprod', [idventa]);
        for (const { idprod, cantidad } of detalles.rows) {
            const stock = await client.query(
                'UPDATE producto SET cantstock = cantstock - $1 WHERE idprod = $2 AND cantstock >= $1 RETURNING cantstock',
                [cantidad, idprod]);
            if (!stock.rows.length) {
                await client.query('ROLLBACK');
                return { sinStock: true };
            }
        }

        await client.query(`UPDATE venta SET estadopedido = 'Pagado', pagado_en = NOW() WHERE idventa = $1`, [idventa]);
        await client.query('COMMIT');
        return { estado: 'Pagado' };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Si al confirmar el pago ya no hay stock, se devuelve el dinero y la venta se cancela.
 * El stock nunca se descontó, así que no hay nada que regresar al inventario.
 */
async function reembolsarSinStock(intent) {
    await stripe().refunds.create({ payment_intent: intent.id }, { idempotencyKey: `reembolso-${intent.id}` });
    await db.query(`UPDATE venta SET estadopedido = 'CANCELADO' WHERE stripe_payment_intent = $1 AND estadopedido = $2`,
        [intent.id, PENDIENTE]);
}

/**
 * Si el pago es de OXXO y Stripe ya generó la ficha, guarda en la venta el enlace a la ficha
 * (con código de barras), el número de referencia y la fecha de vencimiento. Devuelve la ficha o null.
 */
async function guardarFichaOxxo(intent) {
    const ficha = intent.next_action?.oxxo_display_details;
    if (intent.status !== 'requires_action' || !ficha?.hosted_voucher_url) return null;
    const datos = {
        fichaUrl: ficha.hosted_voucher_url,
        referencia: ficha.number ?? null,
        vence: ficha.expires_after ? new Date(ficha.expires_after * 1000) : null
    };
    await db.query(
        'UPDATE venta SET oxxo_ficha_url = $1, oxxo_referencia = $2, oxxo_vence = $3 WHERE stripe_payment_intent = $4',
        [datos.fichaUrl, datos.referencia, datos.vence, intent.id]);
    return datos;
}

/**
 * POST /api/pagos/confirmar/:idventa - El cliente avisa que terminó de pagar (tarjeta) o que ya tiene
 * su ficha de OXXO. No se le cree al navegador: se le pregunta a Stripe el estado real del pago.
 */
const confirmarPago = async (req, res) => {
    const idventa = Number(req.params.idventa);
    const cliente = stripe();
    if (!cliente) return res.status(503).json({ message: 'Los pagos con tarjeta no están configurados.' });

    try {
        const venta = await db.query('SELECT idusuario, stripe_payment_intent FROM venta WHERE idventa = $1', [idventa]);
        if (!venta.rows.length) return res.status(404).json({ message: 'La venta no existe.' });
        if (Number(venta.rows[0].idusuario) !== Number(req.usuario.idUsuario)) {
            return res.status(403).json({ message: 'No puedes confirmar el pago de otro usuario.' });
        }
        if (!venta.rows[0].stripe_payment_intent) {
            return res.status(400).json({ message: 'Esta venta no tiene un pago de Stripe.' });
        }

        const intent = await cliente.paymentIntents.retrieve(venta.rows[0].stripe_payment_intent);

        // OXXO: la ficha ya existe pero el cliente aún no paga en tienda; el pedido sigue pendiente.
        const ficha = await guardarFichaOxxo(intent);
        if (ficha) {
            return res.status(202).json({
                message: 'Ficha de OXXO generada. Tu pedido se confirmará cuando pagues en tienda.',
                idVenta: idventa, estadopedido: PENDIENTE, ...ficha
            });
        }

        const resultado = await aplicarPago(intent);
        if (resultado.sinStock) {
            await reembolsarSinStock(intent);
            return res.status(409).json({
                message: 'Mientras pagabas se agotó un producto. Cancelamos el pedido y te devolvimos el dinero.'
            });
        }
        if (resultado.estado !== 'Pagado') {
            return res.status(402).json({ message: 'Stripe todavía no confirma el pago.', estadopedido: resultado.estado });
        }
        res.json({ message: 'Pago confirmado.', idVenta: idventa, estadopedido: 'Pagado' });
    } catch (error) {
        console.error(`Error al confirmar el pago de la venta ${idventa}:`, error.message);
        res.status(500).json({ message: 'No se pudo confirmar el pago.' });
    }
};

/** Cancela una venta que seguía esperando su pago (ficha de OXXO vencida o cobro cancelado). */
async function cancelarPendiente(intent) {
    await db.query(`UPDATE venta SET estadopedido = 'CANCELADO' WHERE stripe_payment_intent = $1 AND estadopedido = $2`,
        [intent.id, PENDIENTE]);
}

/**
 * POST /api/pagos/webhook - Stripe avisa aquí lo que pasa con cada pago (HU4.4).
 * Recibe el cuerpo SIN parsear (express.raw) porque la firma se calcula sobre los bytes originales;
 * cualquier aviso sin una firma válida de Stripe se rechaza, así nadie puede fingir un pago.
 * Responder con error hace que Stripe reintente el aviso más tarde.
 */
const webhookStripe = async (req, res) => {
    const cliente = stripe();
    if (!cliente || !process.env.STRIPE_WEBHOOK_SECRET) {
        return res.status(503).json({ message: 'El webhook de Stripe no está configurado.' });
    }

    let evento;
    try {
        evento = cliente.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
    } catch (error) {
        console.error('Webhook de Stripe con firma inválida:', error.message);
        return res.status(400).json({ message: 'Firma inválida.' });
    }

    const intent = evento.data?.object;
    // Pagos de la cuenta que no salieron de la tienda (p. ej., 'stripe trigger'): se confirman sin hacer nada,
    // porque responder con error haría que Stripe los reintentara durante días.
    if (!intent?.metadata?.idventa) {
        return res.json({ recibido: true, ignorado: true });
    }
    try {
        switch (evento.type) {
            case 'payment_intent.succeeded': {
                const resultado = await aplicarPago(intent);
                if (resultado.sinStock) await reembolsarSinStock(intent);
                break;
            }
            case 'payment_intent.requires_action':
                await guardarFichaOxxo(intent);
                break;
            case 'payment_intent.payment_failed':
                // En OXXO esto significa que la ficha venció sin pagarse. Una tarjeta rechazada,
                // en cambio, puede reintentarse con otra, así que su venta sigue pendiente.
                if (intent.payment_method_types?.includes('oxxo')) await cancelarPendiente(intent);
                break;
            case 'payment_intent.canceled':
                await cancelarPendiente(intent);
                break;
            default:
                break; // Los demás eventos no afectan los pedidos.
        }
        res.json({ recibido: true });
    } catch (error) {
        console.error(`Error al procesar el evento ${evento.type} de Stripe:`, error.message);
        res.status(500).json({ message: 'No se pudo procesar el evento.' });
    }
};

module.exports = {
    aplicarPago, reembolsarSinStock, guardarFichaOxxo, cancelarPendiente, confirmarPago, webhookStripe, PENDIENTE
};
