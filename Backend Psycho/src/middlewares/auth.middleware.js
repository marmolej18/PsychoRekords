const jwt = require('jsonwebtoken');
const db = require('../db');

/**
 * 1. Middleware de Autenticación General:
 * Valida el JWT y verifica que no esté revocado en la lista negra (logout).
 */
const verificarToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];

    // Validar que el header exista y tenga el prefijo 'Bearer '
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            message: 'Acceso denegado: Token no proporcionado o formato inválido.' 
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        // A. Verificar si el token fue invalidado en un logout previo
        const blockResult = await db.query(
            'SELECT 1 FROM token_blocklist WHERE token = $1',
            [token]
        );

        if (blockResult.rowCount > 0) {
            return res.status(401).json({ 
                message: 'Token inválido o sesión cerrada previamente.' 
            });
        }

        // B. Verificar firma y vigencia del token
        const decoded = jwt.verify(
            token, 
            process.env.JWT_SECRET || 'secreto_super_seguro_psychorekords'
        );

        // Inyectamos el usuario decodificado en la request
        // (contiene idUsuario, correoElectronico, rol)
        req.usuario = decoded;
        next();

    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                message: 'El token ha expirado. Inicia sesión nuevamente.' 
            });
        }
        return res.status(403).json({ message: 'Token no válido o alterado.' });
    }
};

/**
 * 2. Middleware de Autorización por Rol:
 * Se ejecuta SIEMPRE DESPUÉS de verificarToken. No necesita hacer consultas a BD
 * porque el rol ya viene garantizado por la firma del JWT.
 */
const verificarAdmin = (req, res, next) => {
    // Si verificarToken no se ejecutó antes o no hay usuario
    if (!req.usuario) {
        return res.status(401).json({ 
            message: 'Acceso denegado. Se requiere autenticación previa.' 
        });
    }

    // Comprobamos el rol que viene dentro del token
    if (req.usuario.rol !== 'admin') {
        return res.status(403).json({ 
            message: 'Acceso prohibido. Requiere permisos de administrador.' 
        });
    }

    next();
};

module.exports = {
    verificarToken,
    verificarAdmin,
};