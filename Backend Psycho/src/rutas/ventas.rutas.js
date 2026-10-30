const express = require('express');
const router = express.Router();
const ventasController = require('../controladores/ventas.controlador');
const { verificarToken, verificarAdmin } = require('../middlewares/auth.middleware');

router.post('/', verificarToken, ventasController.crearVenta);
router.get('/usuario/:idUsuario', verificarToken, ventasController.getVentasByUsuario);
router.put('/cancelar/:idventa', verificarToken, verificarAdmin, ventasController.cancelarVenta); // Nuevo
router.get('/todas', verificarToken, verificarAdmin, ventasController.getTodasLasVentas); // Nuevo
router.get('/detalle/:idventa', verificarToken, verificarAdmin, ventasController.getDetalleVenta);
module.exports = router;
