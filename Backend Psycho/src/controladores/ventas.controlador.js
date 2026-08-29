// src/controllers/ventas.controller.js
const db = require('../db');

/**
 * POST /api/ventas - Crea una nueva venta y sus detalles (Checkout)
 * * Body esperado (ejemplo):
 * {
 * "idUsuario": 1,
 * "idPunto": 1,
 * "productos": [
 * { "idProd": 1, "cantidad": 2, "precioUnitario": 550.00 },
 * { "idProd": 2, "cantidad": 1, "precioUnitario": 120.00 }
 * ]
 * }
 */
const crearVenta = async (req, res) => {
    const { idusuario, idpunto, productos } = req.body;

    // pre validacion de stock usando funcion
    try {
        for (const item of productos) {
            const { idprod, cantidad } = item;

            // Llama a la función SQL para verificar el stock
            // Si la función lanza una excepción (stock insuficiente), se detiene aquí.
            await db.query('SELECT verificar_stock_disponible($1, $2)', [idprod, cantidad]);

            console.log(`Stock verificado para idProd ${idprod}.`);
        }
    } catch (error) {
        // Captura la excepción lanzada por la función SQL
        console.error('Error de pre-validación de stock:', error.message);
        return res.status(400).json({ // Usamos 400 Bad Request para errores de datos
            message: 'Falló la validación de stock.',
            error: error.message
        });
    }

    // 1. Obtener un cliente para la transacción
    const client = await db.getClient();

    try {
        // --- INICIO DE LA TRANSACCIÓN ---
        await client.query('BEGIN');

        // Calcular el total de la venta
        const totalVenta = productos.reduce((sum, item) => sum + (item.cantidad * item.precioUnitario), 0);

        // 2. Insertar en la tabla Venta
        const ventaQuery = `
            INSERT INTO "venta" ("idusuario", "idpunto", "totalventa", "estadopedido")
            VALUES ($1, $2, $3, 'Pagado')
            RETURNING "idventa", "fecha"`; // RETURNING nos da el ID y la fecha generados

        const resultVenta = await client.query(ventaQuery, [idusuario, idpunto, totalVenta]);
        const idVenta = resultVenta.rows[0].idventa;
        const fechaVenta = resultVenta.rows[0].fecha;

        // 3. Insertar en DetalleVenta y actualizar Stock
        for (const item of productos) {
            const { idprod, cantidad, precioUnitario } = item;

            // 3a. Verificar y actualizar Stock (Query importante)
            const stockCheckQuery = `
                UPDATE "producto"
                SET "cantstock" = "cantstock" - $1
                WHERE "idprod" = $2 AND "cantstock" >= $1
                RETURNING "cantstock"`; // Retorna el nuevo stock o nada si falla la condición

            const stockResult = await client.query(stockCheckQuery, [cantidad, idprod]);

            if (stockResult.rows.length === 0) {
                // Si la fila no se actualizó, significa que no había stock suficiente o el producto no existe
                throw new Error(`Stock insuficiente o producto no encontrado para idProd: ${idprod}.`);
            }

            // 3b. Insertar en DetalleVenta
            const detalleQuery = `
                INSERT INTO "detalleventa" ("idventa", "idprod", "cantidad", "preciounitario")
                VALUES ($1, $2, $3, $4)`;

            await client.query(detalleQuery, [idVenta, idprod, cantidad, precioUnitario]);
        }

        // 4. Si todo salió bien: COMMIT (confirmar la transacción)
        await client.query('COMMIT');

        res.status(201).json({
            message: 'Venta creada exitosamente y stock actualizado.',
            idVenta,
            fechaVenta,
            totalVenta
        });

    } catch (error) {
        // 5. Si algo falló: ROLLBACK (deshacer todos los cambios)
        await client.query('ROLLBACK');

        console.error('Error en la transacción de venta:', error);
        res.status(500).json({
            message: 'Falló la creación de la venta. Se revirtieron los cambios.',
            error: error.message
        });

    } finally {
        // 6. Liberar el cliente del pool
        client.release();
    }
};

/**
 * GET /api/ventas/usuario/:idUsuario - Obtener historial de ventas de un usuario
 */
const getVentasByUsuario = async (req, res) => {
    const idUsuario = req.params.idUsuario;

    // Consulta simple a la VISTA
    const queryText = `
        SELECT 
            "idventa", 
            "fecha", 
            "totalventa", 
            "estadopedido",
            "nombrepunto", 
            "direccioncompleta", 
            detalles 
        FROM vw_historial_ventas 
        WHERE "idusuario" = $1;
    `;

    try {
        const result = await db.query(queryText, [idUsuario]);

        if (result.rows.length === 0) {
            return res.status(200).json({
                message: 'El usuario no tiene ventas registradas.',
                ventas: []
            });
        }

        res.status(200).json(result.rows);
    } catch (error) {
        console.error(`Error al obtener ventas del usuario ${idUsuario}:`, error);
        res.status(500).json({ message: 'Error interno del servidor al consultar historial de ventas.' });
    }
};



const cancelarVenta = async (req, res) => {
    // Declarar con let en el ámbito más alto de la función
    let idVentaStr;
    let idVenta;

    try {
        // 1. Lectura del parámetro (usando el nombre minúsculas de la ruta)
        idVentaStr = req.params.idventa;
        const idAdmin = req.header('x-user-id');

        // 2. Validación y Conversión (Previene el error de tipo integer)
        if (!idVentaStr || isNaN(Number(idVentaStr))) {
            return res.status(400).json({
                message: 'Error: El ID de venta proporcionado no es un número válido o está ausente.',
                url: req.originalUrl // Útil para depuración
            });
        }
        idVenta = Number(idVentaStr); // Convertir a número antes de usarlo en el query

        // 3. Llamar al procedimiento almacenado
        const queryText = `CALL sp_cancelar_venta($1, $2);`;
        await db.query(queryText, [idVenta, idAdmin]); // Usamos el número

        // 4. Éxito
        res.status(200).json({
            message: `Venta #${idVenta} cancelada y stock revertido con éxito.`,
            idVenta: idVenta
        });

    } catch (error) {
        // 5. Manejo de Error: idVenta está garantizado que existe aquí
        console.error(`Error al cancelar venta ${idVenta}:`, error.message);

        // Manejo de errores de PL/pgSQL
        let errorMessage = error.message.includes('Falló') ?
            error.message.split('ERROR:  ')[1] :
            'Error desconocido al intentar cancelar la venta.';

        res.status(400).json({ message: errorMessage });
    }
};



const getTodasLasVentas = async (req, res) => {
    // Nota: El middleware verificarAdmin ya protege esta ruta.

    // Consulta simple a la VISTA sin filtro por usuario
    const queryText = `
        SELECT 
            "idventa", 
            "fecha", 
            "totalventa", 
            "estadopedido",
            "nombrepunto", 
            "direccioncompleta", 
            detalles 
        FROM vw_historial_ventas 
        ORDER BY "fecha" DESC;
    `;

    try {
        const result = await db.query(queryText);

        const ventas = result.rows.map(venta => ({
            idventa: venta.idventa,
            fecha: venta.fecha,
            totalventa: Number(venta.totalventa),
            estadopedido: venta.estadopedido,
            nombrepunto: venta.nombrepunto,
            direccionCompleta: venta.direccioncompleta,
            detalles: venta.detalles
            // Podrías añadir V.idusuario si lo necesitas en el frontend
        }));

        res.status(200).json(ventas);
    } catch (error) {
        console.error('Error al obtener todas las ventas:', error);
        res.status(500).json({ message: 'Error interno del servidor al consultar todas las ventas.' });
    }
};


module.exports = {
    crearVenta,
    getVentasByUsuario,
    cancelarVenta,
    getTodasLasVentas
};