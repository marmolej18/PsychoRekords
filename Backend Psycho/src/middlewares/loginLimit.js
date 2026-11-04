const buckets = new Map();
const WINDOW = 15 * 60 * 1000;
const cleanup = setInterval(() => { for (const [k,v] of buckets) if (v.until <= Date.now()) buckets.delete(k); }, 60000);
cleanup.unref();
function loginLimit(req, res, next) {
    const now = Date.now();
    // Se limita la IP y la combinación IP/cuenta; no se bloquea globalmente una cuenta ajena.
    const keys = [[req.ip, 30], [`${req.ip}:${String(req.body?.correoElectronico || '').trim().toLowerCase().slice(0,100)}`, 5]];
    for (const [key, max] of keys) {
        const item = buckets.get(key);
        if (item && item.until > now && item.count >= max) {
            res.set('Retry-After', String(Math.ceil((item.until - now) / 1000)));
            return res.status(429).json({ message: 'Demasiados intentos. Espera unos minutos antes de volver a intentar.' });
        }
    }
    for (const [key] of keys) {
        let item = buckets.get(key);
        if (!item || item.until <= now) { item = { count: 0, until: now + WINDOW }; buckets.set(key, item); }
        item.count++;
    }
    res.on('finish', () => { if (res.statusCode === 200) buckets.delete(keys[1][0]); });
    next();
}
module.exports = { loginLimit };
