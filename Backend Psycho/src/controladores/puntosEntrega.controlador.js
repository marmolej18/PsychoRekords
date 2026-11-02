// src/controllers/puntosEntrega.controller.js
const db = require('../db');

/**
 * GET /api/puntos-entrega - Puntos medios de entrega gratuita que siguen activos
 */
const getPuntosEntrega = async (req, res) => {
    const queryText = 'SELECT "idpunto", "nombrepunto", "direccioncompleta", "horarioatencion" FROM "puntoentrega" WHERE "activo" ORDER BY "idpunto" ASC';

    try {
        const result = await db.query(queryText);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener puntos de entrega:', error);
        res.status(500).json({ message: 'Error interno del servidor al consultar puntos de entrega.' });
    }
};

/**
 * GET /api/tarifas-envio - Tarifas fijas de envío a domicilio por paquetería, de la más barata a la más cara
 */
const getTarifasEnvio = async (req, res) => {
    try {
        const result = await db.query(`
            SELECT idtarifa, paqueteria, servicio, precio, dias_min, dias_max
            FROM tarifaenvio WHERE activo ORDER BY precio ASC`);
        res.status(200).json(result.rows.map(t => ({ ...t, precio: Number(t.precio) })));
    } catch (error) {
        console.error('Error al obtener tarifas de envío:', error);
        res.status(500).json({ message: 'Error interno del servidor al consultar tarifas de envío.' });
    }
};

module.exports = {
    getPuntosEntrega,
    getTarifasEnvio
};
