// src/controllers/usuarios.controller.js
const db = require('../db');

/**
 * POST /api/usuarios/registro - Registrar un nuevo Usuario
 */
const registrarUsuario = async (req, res) => {
    const { nombre, apellidoP, apellidoM, correoElectronico, password, telefono, CP, calle, colonia, numCasa, ciudad, estado } = req.body;

    // Consulta SQL para insertar el nuevo usuario
    const queryText = `
        INSERT INTO "usuario" (
            "nombre", "apellidop", "apellidom", "correoelectronico", "password", "telefono", 
            "cp", "calle", "colonia", "numcasa", "ciudad", "estado"
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING "idusuario", "correoelectronico"`; // Devolver el ID generado

    const values = [nombre, apellidoP, apellidoM, correoElectronico, password, telefono, CP, calle, colonia, numCasa, ciudad, estado];

    try {
        const existsResult = await db.query(
            'SELECT verificar_correo_existente($1, $2) AS exists',
            [correoElectronico, null]
        );

        if (existsResult.rows[0].exists) {
            return res.status(409).json({ message: 'El correo electrónico ya pertenece a otra cuenta.' });
        }

        const result = await db.query(queryText, values);
        const nuevoUsuario = result.rows[0];

        res.status(201).json({
            message: 'Usuario registrado exitosamente.',
            idUsuario: nuevoUsuario.idusuario,
            correoElectronico: nuevoUsuario.correoelectronico
        });
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        // Manejo específico para violación de UNIQUE (correoElectronico)
        if (error.code === '23505') {
            return res.status(409).json({ message: 'El correo electrónico ya está registrado.' });
        }
        res.status(500).json({ message: 'Error interno del servidor al registrar usuario.' });
    }
};

/**
 * GET /api/usuarios/:id - Obtener perfil del usuario
 */
const getUsuarioById = async (req, res) => {
    const idUsuario = req.params.id;
    const queryText = 'SELECT * FROM "usuario" WHERE "idusuario" = $1';

    try {
        const result = await db.query(queryText, [idUsuario]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        // Evita enviar campos sensibles si los tuvieras (ej: contraseña, aunque aquí no está)
        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(`Error al obtener usuario ${idUsuario}:`, error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

/**
 * POST /api/usuarios/login - Autenticar al usuario
 * Body esperado: { "correoElectronico": "...", "password": "..." }
 */
const loginUsuario = async (req, res) => {
    const { correoElectronico, password } = req.body;

    if (!correoElectronico || !password) {
        return res.status(400).json({ message: 'El correo electrónico y la contraseña son obligatorios.' });
    }

    // Consulta para buscar el usuario por correo y verificar la contraseña
    const queryText = `
        SELECT "idusuario", "nombre", "apellidop", "apellidom", "correoelectronico", "rol"
        FROM "usuario"
        WHERE "correoelectronico" = $1 AND "password" = $2;
    `;

    try {
        const result = await db.query(queryText, [correoElectronico, password]);

        if (result.rows.length === 0) {
            // Credenciales inválidas
            return res.status(401).json({ message: 'Correo o contraseña incorrectos.' });
        }

        const usuario = result.rows[0];

        // Autenticación exitosa
        res.status(200).json({
            message: 'Autenticación exitosa.',
            usuario: {
                idUsuario: usuario.idusuario,
                nombre: usuario.nombre,
                correoElectronico: usuario.correoElectronico,
                rol: usuario.rol
            }
        });

    } catch (error) {
        console.error('Error durante el login:', error);
        res.status(500).json({ message: 'Error interno del servidor durante la autenticación.' });
    }
};

/**
 * [GET] /api/usuarios - Obtener la lista completa de usuarios (Admin)
 */
const getAllUsers = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT 
                "idusuario", nombre, "apellidop", "apellidom", 
                "correoelectronico", telefono, rol, 
                "cp", calle, colonia, "numcasa", ciudad, estado
            FROM 
                "usuario"
            ORDER BY "idusuario" DESC
        `);
        // Adaptamos los nombres de columna a CamelCase en la respuesta para el frontend
        const users = result.rows.map(row => ({
            idUsuario: row.idusuario,
            nombre: row.nombre,
            apellidoP: row.apellidop,
            apellidoM: row.apellidom,
            correoElectronico: row.correoelectronico,
            telefono: row.telefono,
            rol: row.rol,
            CP: row.cp,
            calle: row.calle,
            colonia: row.colonia,
            numCasa: row.numcasa,
            ciudad: row.ciudad,
            estado: row.estado
        }));
        res.json(users);
    } catch (err) {
        console.error('Error al obtener todos los usuarios:', err);
        res.status(500).json({ message: 'Error interno del servidor al listar usuarios.' });
    }
};

/**
 * [PUT] /api/usuarios/:id - Actualizar datos del usuario (Admin/Propio)
 */
const updateUser = async (req, res) => {
    const { id } = req.params;
    // El rol se incluirá aquí para que el Admin pueda cambiarlo.
    const {
        nombre, apellidoP, apellidoM, correoElectronico,
        telefono, rol, CP, calle, colonia, numCasa, ciudad, estado
    } = req.body;

    try {
        const existsResult = await db.query(
            'SELECT verificar_correo_existente($1, $2) AS exists',
            [correoElectronico, id]
        );

        if (existsResult.rows[0].exists) {
            return res.status(409).json({ message: 'El correo electrónico ya pertenece a otra cuenta.' });
        }

        const result = await db.query(`
            UPDATE "usuario" SET 
                nombre = $1, 
                "apellidop" = $2, 
                "apellidom" = $3, 
                "correoelectronico" = $4, 
                telefono = $5, 
                rol = $6,
                "cp" = $7,
                calle = $8,
                colonia = $9,
                "numcasa" = $10,
                ciudad = $11,
                estado = $12
            WHERE 
                "idusuario" = $13
            RETURNING "idusuario"
        `, [
            nombre, apellidoP, apellidoM, correoElectronico,
            telefono, rol, CP, calle, colonia, numCasa, ciudad, estado, id
        ]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        res.json({ message: `Usuario ID ${id} actualizado exitosamente.`, idUsuario: id });
    } catch (err) {
        if (err.code === '23505') {
            return res.status(409).json({ message: 'El correo electrónico ya está registrado en otra cuenta.' });
        }
        console.error(`Error al actualizar usuario ${id}:`, err);
        res.status(500).json({ message: 'Error interno del servidor al actualizar.' });
    }
};

/**
 * [DELETE] /api/usuarios/:id - Eliminar/Desactivar un usuario (Admin)
 */
const deleteUser = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.query(`
            DELETE FROM "usuario" WHERE "idusuario" = $1
        `, [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }

        res.json({ message: `Usuario ID ${id} eliminado exitosamente.` });
    } catch (err) {
        if (err.code === '23503') {
            return res.status(400).json({ message: 'No se puede eliminar el usuario porque tiene pedidos asociados.' });
        }
        console.error(`Error al eliminar usuario ${id}:`, err);
        res.status(500).json({ message: 'Error interno del servidor al eliminar.' });
    }
};


module.exports = {
    registrarUsuario,
    getUsuarioById,
    loginUsuario,
    getAllUsers,
    updateUser,
    deleteUser
};