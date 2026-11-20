const Stripe = require('stripe');

let cliente = null;

// Cliente de Stripe con la llave secreta del .env (STRIPE_SECRET_KEY), o null si no está configurada.
// Se crea una sola vez y solo cuando se necesita, para que el backend arranque aunque falte la llave.
function stripe() {
    if (!process.env.STRIPE_SECRET_KEY) return null;
    if (!cliente) cliente = new Stripe(process.env.STRIPE_SECRET_KEY);
    return cliente;
}

module.exports = { stripe };
