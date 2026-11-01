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

    // Un cliente solo puede consultar su propio historial; el admin puede ver cualquiera.
    if (req.usuario.rol !== 'admin' && Number(idUsuario) !== Number(req.usuario.idUsuario)) {
        return res.status(403).json({ message: 'No puedes consultar los pedidos de otro usuario.' });
    }

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
        const idAdmin = req.usuario?.idUsuario || req.header('x-user-id');

        // 2. Validación y Conversión (Previene el error de tipo integer)
        if (!idVentaStr || isNaN(Number(idVentaStr))) {
            return res.status(400).json({
                message: 'Error: El ID de venta proporcionado no es un número válido o está ausente.',
                url: req.originalUrl // Útil para depuración
            });
        }
        idVenta = Number(idVentaStr); // Convertir a número antes de usarlo en el query

        // Un pedido entregado ya salió de la tienda: no se puede regresar su stock al inventario.
        const actual = await db.query('SELECT estadopedido FROM venta WHERE idventa = $1', [idVenta]);
        if (actual.rows[0]?.estadopedido?.toUpperCase() === 'ENTREGADO') {
            return res.status(409).json({ message: `El pedido #${idVenta} ya fue entregado y no se puede cancelar.` });
        }

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

        // Manejo de errores de PL/pgSQL: "Falló la cancelación de la venta N: ERROR: <motivo>"
        const motivo = error.message.match(/ERROR:\s*(.+)$/);
        let errorMessage = error.message.includes('Falló') && motivo ?
            motivo[1] :
            'Error desconocido al intentar cancelar la venta.';

        res.status(400).json({ message: errorMessage });
    }
};



const consultaVentas = `
    SELECT v.idventa, v.fecha, v.totalventa, v.estadopedido,
           concat_ws(' ', u.nombre, u.apellidop, u.apellidom) AS cliente,
           u.correoelectronico AS correo, pe.nombrepunto,
           pe.direccioncompleta
    FROM venta v
    LEFT JOIN usuario u ON u.idusuario = v.idusuario
    LEFT JOIN puntoentrega pe ON pe.idpunto = v.idpunto`;

const getTodasLasVentas = async (req, res) => {
    try {
        const result = await db.query(`SELECT v.*,
            COALESCE((SELECT json_agg(json_build_object(
                'iddetalle', dv.iddetalle, 'titulo', p.titulo, 'artista', p.artista,
                'cantidad', dv.cantidad, 'precioUnitario', dv.preciounitario) ORDER BY dv.iddetalle)
                FROM detalleventa dv LEFT JOIN producto p ON p.idprod = dv.idprod
                WHERE dv.idventa = v.idventa AND dv.cantidad > 0), '[]'::json) AS detalles
            FROM (${consultaVentas}) v ORDER BY v.fecha DESC, v.idventa DESC`);
        res.json(result.rows.map(venta => ({ ...venta, totalventa: Number(venta.totalventa) })));
    } catch (error) {
        console.error('Error al consultar ventas:', error);
        res.status(500).json({ message: 'No se pudieron consultar las ventas.' });
    }
};

const getDetalleVenta = async (req, res) => {
    const idventa = Number(req.params.idventa);
    if (!Number.isSafeInteger(idventa) || idventa <= 0) {
        return res.status(400).json({ message: 'El número de venta no es válido.' });
    }
    try {
        const result = await db.query(consultaVentas + ' WHERE v.idventa = $1', [idventa]);
        if (!result.rows.length) {
            return res.status(404).json({ message: 'La venta no existe.' });
        }
        // Las cantidades negativas corresponden a ajustes de cancelación, no al pedido original.
        const detalles = await db.query(`
            SELECT dv.iddetalle, p.titulo, p.artista, dv.cantidad,
                   dv.preciounitario AS "precioUnitario"
            FROM detalleventa dv
            LEFT JOIN producto p ON p.idprod = dv.idprod
            WHERE dv.idventa = $1 AND dv.cantidad > 0
            ORDER BY dv.iddetalle`, [idventa]);
        res.json({ ...result.rows[0], totalventa: Number(result.rows[0].totalventa),
            detalles: detalles.rows.map(d => ({ ...d, precioUnitario: Number(d.precioUnitario) })) });
    } catch (error) {
        console.error('Error al consultar el detalle de venta:', error);
        res.status(500).json({ message: 'No se pudo consultar el detalle de la venta.' });
    }
};

/**
 * GET /api/ventas/mis-pedidos - Pedidos del cliente autenticado (el id sale del JWT, no de la URL).
 */
const getMisPedidos = async (req, res) => {
    const idusuario = Number(req.usuario?.idUsuario);
    if (!Number.isSafeInteger(idusuario) || idusuario <= 0) {
        return res.status(401).json({ message: 'Sesión inválida.' });
    }
    try {
        // Las cantidades negativas corresponden a ajustes de cancelación, no al pedido original.
        const result = await db.query(`
            SELECT v.idventa, v.fecha, v.totalventa, v.estadopedido,
                   pe.nombrepunto, pe.direccioncompleta, pe.horarioatencion,
                   COALESCE((SELECT json_agg(json_build_object(
                       'iddetalle', dv.iddetalle, 'titulo', p.titulo, 'artista', p.artista,
                       'cantidad', dv.cantidad, 'precioUnitario', dv.preciounitario) ORDER BY dv.iddetalle)
                       FROM detalleventa dv LEFT JOIN producto p ON p.idprod = dv.idprod
                       WHERE dv.idventa = v.idventa AND dv.cantidad > 0), '[]'::json) AS detalles
            FROM venta v
            LEFT JOIN puntoentrega pe ON pe.idpunto = v.idpunto
            WHERE v.idusuario = $1
            ORDER BY v.fecha DESC, v.idventa DESC`, [idusuario]);
        res.json(result.rows.map(venta => ({
            ...venta,
            totalventa: Number(venta.totalventa),
            detalles: venta.detalles.map(d => ({ ...d, precioUnitario: Number(d.precioUnitario) }))
        })));
    } catch (error) {
        console.error(`Error al consultar los pedidos del usuario ${idusuario}:`, error);
        res.status(500).json({ message: 'No se pudieron consultar tus pedidos.' });
    }
};

// Flujo de un pedido de recogida en tienda. La cancelación va aparte, por sp_cancelar_venta.
const ETAPAS_PEDIDO = ['Pagado', 'Listo para recoger', 'Entregado'];

/**
 * PUT /api/ventas/estado/:idventa - Avanza el pedido a la siguiente etapa (Admin).
 * Body: { "estado": "Listo para recoger" }
 */
const avanzarEstadoVenta = async (req, res) => {
    const idventa = Number(req.params.idventa);
    if (!Number.isSafeInteger(idventa) || idventa <= 0) {
        return res.status(400).json({ message: 'El número de venta no es válido.' });
    }
    const estado = req.body?.estado;
    const destino = ETAPAS_PEDIDO.indexOf(estado);
    if (destino < 1) {
        return res.status(400).json({ message: 'El estado solicitado no es válido.' });
    }
    try {
        // Solo avanza si el pedido está justo en la etapa anterior: evita saltos, retrocesos y dobles clics.
        const result = await db.query(`
            UPDATE venta SET estadopedido = $1
            WHERE idventa = $2 AND upper(estadopedido) = upper($3)
            RETURNING idventa, estadopedido`, [estado, idventa, ETAPAS_PEDIDO[destino - 1]]);
        if (!result.rows.length) {
            const actual = await db.query('SELECT estadopedido FROM venta WHERE idventa = $1', [idventa]);
            if (!actual.rows.length) {
                return res.status(404).json({ message: 'La venta no existe.' });
            }
            return res.status(409).json({
                message: `El pedido está en "${actual.rows[0].estadopedido}" y no puede pasar a "${estado}".`
            });
        }
        res.json({ message: `Pedido #${idventa} actualizado a "${estado}".`, ...result.rows[0] });
    } catch (error) {
        console.error(`Error al actualizar el estado de la venta ${idventa}:`, error);
        res.status(500).json({ message: 'No se pudo actualizar el estado del pedido.' });
    }
};

module.exports = { crearVenta, getVentasByUsuario, cancelarVenta, getTodasLasVentas, getDetalleVenta, getMisPedidos, avanzarEstadoVenta };
