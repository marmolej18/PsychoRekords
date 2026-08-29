// src/routes/reportes.routes.js
const express = require('express');
const router = express.Router();
const reportesController = require('../controladores/reportes.controlador');
const { verificarAdmin } = require('../middlewares/auth.middleware'); // Proteger todas las rutas

// Todas las rutas requieren verificación de administrador
router.get('/rentables', verificarAdmin, reportesController.getReporteRentables);
router.get('/ventas-formato', verificarAdmin, reportesController.getReporteVentasFormato);
// Nueva ruta para el Trigger de anulación
router.get('/movimiento-inventario', verificarAdmin, reportesController.getMovimientoInventario);
router.get('/stock-trazabilidad/:idProd', verificarAdmin, reportesController.getTrazabilidadStock);

module.exports = router;