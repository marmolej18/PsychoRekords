// src/controllers/puntosEntrega.controller.js
const db = require('../db');

/**
 * GET /api/puntos-entrega - Obtener todos los puntos de entrega
 */
const getPuntosEntrega = async (req, res) => {
    const queryText = 'SELECT "idpunto", "nombrepunto", "direccioncompleta", "horarioatencion" FROM "puntoentrega" ORDER BY "nombrepunto" ASC';

    try {
        const result = await db.query(queryText);
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Error al obtener puntos de entrega:', error);
        res.status(500).json({ message: 'Error interno del servidor al consultar puntos de entrega.' });
    }
};

module.exports = {
    getPuntosEntrega
};