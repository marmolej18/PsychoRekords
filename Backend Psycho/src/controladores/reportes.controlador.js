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


module.exports = {
    getReporteRentables,
    getReporteVentasFormato,
    getMovimientoInventario,
    getTrazabilidadStock
};