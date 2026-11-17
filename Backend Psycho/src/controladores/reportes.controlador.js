// src/controllers/reportes.controller.js
const db = require('../db');

/**
 * GET /api/reportes/rentables - Reporte de Productos Más Rentables
 */
const getReporteRentables = async (req, res) => {
    // Consulta simple a la vista vw_productos_rentables
    const queryText = 'SELECT * FROM vw_productos_rentables;'; 
    try {
        const result = await db.query(queryText);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener reporte de rentabilidad:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

/**
 * GET /api/reportes/ventas-formato - Reporte de Ventas por Artista y Formato (ROLLUP)
 */
const getReporteVentasFormato = async (req, res) => {
    // Consulta simple a la vista vw_ventas_por_formato
    const queryText = 'SELECT * FROM vw_ventas_por_formato;'; 
    try {
        const result = await db.query(queryText);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener reporte ROLLUP:', error);
        res.status(500).json({ message: 'Error interno del servidor.' });
    }
};

// src/controllers/reportes.controller.js (Añadir esta función)

/**
 * GET /api/reportes/movimiento-inventario
 * Reporte que muestra las unidades vendidas vs. anuladas por producto.
 */
const getMovimientoInventario = async (req, res) => {
    const queryText = `
        SELECT
            p.titulo AS nombre_producto,
            SUM(CASE WHEN dv.cantidad > 0 THEN dv.cantidad ELSE 0 END) AS unidades_vendidas,
            SUM(CASE WHEN dv.cantidad < 0 THEN -dv.cantidad ELSE 0 END) AS unidades_anuladas
        FROM detalleventa dv
        JOIN producto p ON dv.idprod = p.idprod
        GROUP BY p.titulo
        ORDER BY unidades_vendidas DESC;
    `;

    try {
        const result = await db.query(queryText);
        
        // Mapear los resultados
        const data = result.rows.map(row => ({
            name: row.nombre_producto,
            series: [
                {
                    name: 'Unidades Vendidas',
                    value: Number(row.unidades_vendidas)
                },
                {
                    name: 'Unidades Anuladas',
                    value: Number(row.unidades_anuladas)
                }
            ]
        }));

        res.status(200).json(data);
    } catch (error) {
        console.error('Error al obtener el movimiento de inventario:', error);
        res.status(500).json({ message: 'Error interno del servidor al consultar el reporte de inventario.' });
    }
};

const getTrazabilidadStock = async (req, res) => {
    const idProd = req.params.idProd;

    const queryText = `
        SELECT
            TO_CHAR(fecha_cambio, 'YYYY-MM-DD HH24:MI') AS "name", -- Usamos fecha/hora como etiqueta
            stock_nuevo AS "value"
        FROM log_auditoria_stock
        WHERE id_prod = $1 
        ORDER BY fecha_cambio ASC;
    `;

    try {
        const result = await db.query(queryText, [idProd]);

        // ngx-charts requiere el formato de matriz de series [{ name: 'Producto X', series: [...] }]
        const data = [{
            name: `Stock del Producto ID: ${idProd}`, 
            series: result.rows.map(row => ({
                name: row.name, // Eje X: Fecha y hora del evento
                value: Number(row.value) // Eje Y: Nivel de stock después del cambio
            }))
        }];

        res.status(200).json(data);
    } catch (error) {
        console.error(`Error al obtener trazabilidad de stock para ${idProd}:`, error);
        res.status(500).json({ message: 'Error interno del servidor al consultar la trazabilidad de stock.' });
    }
};

/**
 * GET /api/reportes/metricas - Métricas básicas de la tienda:
 * ventas del mes (y del mes anterior para comparar), usuarios registrados y producto más vendido del mes.
 * Los pedidos cancelados no cuentan. El mes es el mes calendario actual según la hora del servidor de BD.
 */
const getMetricas = async (req, res) => {
    try {
        const [ventas, usuarios, top] = await Promise.all([
            db.query(`
                SELECT
                    TO_CHAR(date_trunc('month', LOCALTIMESTAMP), 'YYYY-MM') AS periodo,
                    COALESCE(SUM(totalventa) FILTER (WHERE fecha >= date_trunc('month', LOCALTIMESTAMP)), 0) AS ingresos_mes,
                    COUNT(*) FILTER (WHERE fecha >= date_trunc('month', LOCALTIMESTAMP)) AS pedidos_mes,
                    COALESCE(SUM(totalventa) FILTER (WHERE fecha < date_trunc('month', LOCALTIMESTAMP)), 0) AS ingresos_mes_anterior,
                    COUNT(*) FILTER (WHERE fecha < date_trunc('month', LOCALTIMESTAMP)) AS pedidos_mes_anterior
                FROM venta
                WHERE upper(estadopedido) <> 'CANCELADO'
                  AND fecha >= date_trunc('month', LOCALTIMESTAMP) - INTERVAL '1 month'`),
            db.query(`
                SELECT
                    COUNT(*) AS total,
                    COUNT(*) FILTER (WHERE rol = 'cliente') AS clientes,
                    COUNT(*) FILTER (WHERE rol = 'admin') AS admins
                FROM usuario`),
            db.query(`
                SELECT p.idprod, p.titulo, p.artista, SUM(dv.cantidad) AS unidades
                FROM detalleventa dv
                JOIN venta v ON v.idventa = dv.idventa
                JOIN producto p ON p.idprod = dv.idprod
                WHERE v.fecha >= date_trunc('month', LOCALTIMESTAMP)
                  AND upper(v.estadopedido) <> 'CANCELADO'
                GROUP BY p.idprod, p.titulo, p.artista
                HAVING SUM(dv.cantidad) > 0
                ORDER BY unidades DESC, p.titulo
                LIMIT 1`)
        ]);

        const v = ventas.rows[0];
        const u = usuarios.rows[0];
        const t = top.rows[0];
        res.json({
            periodo: v.periodo,
            ventasMes: { ingresos: Number(v.ingresos_mes), pedidos: Number(v.pedidos_mes) },
            ventasMesAnterior: { ingresos: Number(v.ingresos_mes_anterior), pedidos: Number(v.pedidos_mes_anterior) },
            usuarios: { total: Number(u.total), clientes: Number(u.clientes), admins: Number(u.admins) },
            productoTopMes: t ? { idprod: t.idprod, titulo: t.titulo, artista: t.artista, unidades: Number(t.unidades) } : null
        });
    } catch (error) {
        console.error('Error al obtener las métricas:', error);
        res.status(500).json({ message: 'Error interno del servidor al consultar las métricas.' });
    }
};

module.exports = {
    getMetricas,
    getReporteRentables,
    getReporteVentasFormato,
    getMovimientoInventario,
    getTrazabilidadStock
};