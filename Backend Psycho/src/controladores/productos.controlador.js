// src/controllers/productos.controller.js
const db = require('../db');

/**
 * GET /api/productos - Obtener todos los productos del catálogo
 */
const getProductos = async (req, res) => {
    const queryText = 'SELECT * FROM "producto" ORDER BY "titulo" ASC';

    try {
        const result = await db.query(queryText);
        // Los resultados se devuelven en la propiedad 'rows'
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener productos:', error);
        res.status(500).json({
            message: 'Error interno del servidor al consultar el catálogo.',
            error: error.message
        });
    }
};

/**
 * GET /api/productos/:id - Obtener un producto por ID
 */
const getProductoById = async (req, res) => {
    const idProd = req.params.id;
    // $1 es un placeholder seguro para evitar inyección SQL
    const queryText = 'SELECT * FROM "producto" WHERE "idprod" = $1';

    try {
        const result = await db.query(queryText, [idProd]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Producto no encontrado.' });
        }

        res.status(200).json(result.rows[0]);
    } catch (error) {
        console.error(`Error al obtener producto ${idProd}:`, error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

/**
 * POST /api/productos - Crear un nuevo producto (Admin)
 */
const crearProducto = async (req, res) => {
    const { titulo, artista, generomus, aniolanzam, formato, condiciones, cantstock, precio } = req.body;

    // Consulta para insertar un nuevo producto
    const queryText = `
        INSERT INTO "producto" ("titulo", "artista", "generomus", "aniolanzam", "formato", "condiciones", "cantstock", "precio")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`; // Retornar el producto creado

    const values = [titulo, artista, generomus, aniolanzam, formato, condiciones, cantstock, precio];

    try {
        const result = await db.query(queryText, values);
        res.status(201).json({
            message: 'Producto creado exitosamente.',
            producto: result.rows[0]
        });
    } catch (error) {
        console.error('Error al crear producto:', error);
        res.status(500).json({ message: 'Error interno al crear el producto.' });
    }
};

/**
 * PUT /api/productos/:id - Actualizar datos de un producto (Admin)
 */
const actualizarProducto = async (req, res) => {
    const idProd = req.params.id;
    const { titulo, artista, generomus, aniolanzam, formato, condiciones, cantstock, precio } = req.body;

    const queryText = `
        UPDATE "producto"
        SET 
            "titulo" = COALESCE($2, "titulo"),
            "artista" = COALESCE($3, "artista"),
            "generomus" = COALESCE($4, "generomus"),
            "aniolanzam" = COALESCE($5, "aniolanzam"),
            "formato" = COALESCE($6, "formato"),
            "condiciones" = COALESCE($7, "condiciones"),
            "cantstock" = COALESCE($8, "cantstock"),
            "precio" = COALESCE($9, "precio")
        WHERE "idprod" = $1
        RETURNING *`;

    const values = [idProd, titulo, artista, generomus, aniolanzam, formato, condiciones, cantstock, precio];

    try {
        const result = await db.query(queryText, values);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Producto no encontrado para actualizar.' });
        }

        res.status(200).json({
            message: 'Producto actualizado exitosamente.',
            producto: result.rows[0]
        });
    } catch (error) {
        console.error(`Error al actualizar producto ${idProd}:`, error);
        res.status(500).json({ message: 'Error interno al actualizar el producto.' });
    }
};

module.exports = {
    getProductos,
    getProductoById,
    crearProducto,
    actualizarProducto
};