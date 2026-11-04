const { scrypt: derive, randomBytes, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const scrypt = promisify(derive);
async function hashPassword(password) {
    const salt = randomBytes(16).toString('hex');
    const key = await scrypt(password, salt, 32);
    return `scrypt$${salt}$${key.toString('hex')}`;
}
async function verifyPassword(password, stored) {
    if (typeof stored !== 'string' || !/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(stored)) return false;
    const [, salt, hash] = stored.split('$');
    const key = await scrypt(password, salt, 32);
    return timingSafeEqual(key, Buffer.from(hash, 'hex'));
}
module.exports = { hashPassword, verifyPassword };
