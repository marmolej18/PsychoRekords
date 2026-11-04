const db = require('../db');
const { hashPassword } = require('./password');
async function migrar() {
    const client = await db.getClient();
    try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(6192026)');
        await client.query('ALTER TABLE usuario ALTER COLUMN password TYPE VARCHAR(120), ALTER COLUMN password DROP DEFAULT');
        const users = await client.query("SELECT idusuario, password FROM usuario WHERE password NOT LIKE 'scrypt$%' FOR UPDATE");
        for (const user of users.rows) await client.query('UPDATE usuario SET password=$1 WHERE idusuario=$2', [await hashPassword(user.password), user.idusuario]);
        await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
}
module.exports = { migrar };
