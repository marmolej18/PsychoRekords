const db = require('../db');

/**
 * Middleware para verificar si el usuario es un administrador.
 * Requiere que el ID del usuario se envíe en la cabecera 'x-user-id'.
 */
const verificarAdmin = async (req, res, next) => {
    // 1. Obtener el ID del usuario de la cabecera 
    const idUsuario = req.headers['x-user-id'];

    if (!idUsuario) {
        return res.status(401).json({ message: 'Acceso denegado. Se requiere autenticación.' });
    }

    // 2. Consultar el rol del usuario
    const queryText = 'SELECT "rol" FROM "usuario" WHERE "idusuario" = $1';

    try {
        const result = await db.query(queryText, [idUsuario]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        const rol = result.rows[0].rol;

        // 3. Verificar si tiene el rol de administrador
        if (rol !== 'admin') {
            return res.status(403).json({ message: 'Acceso prohibido. Requiere permisos de administrador.' });
        }

        // 4. Si es admin, permitir que continúe
        next();

    } catch (error) {
        console.error('Error en middleware de verificación de admin:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

module.exports = {
    verificarAdmin,
};