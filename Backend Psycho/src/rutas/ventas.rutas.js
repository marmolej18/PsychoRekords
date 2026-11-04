const express = require('express');
const router = express.Router();
router.param('idventa', (req, res, next, value) => { if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) return res.status(400).json({ message: 'Identificador inválido.' }); next(); });
router.param('idUsuario', (req, res, next, value) => { if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) return res.status(400).json({ message: 'Identificador inválido.' }); next(); });
const ventasController = require('../controladores/ventas.controlador');
const { verificarToken, verificarAdmin } = require('../middlewares/auth.middleware');

router.post('/', verificarToken, ventasController.crearVenta);
router.get('/mis-pedidos', verificarToken, ventasController.getMisPedidos);
router.get('/usuario/:idUsuario', verificarToken, ventasController.getVentasByUsuario);
router.put('/cancelar/:idventa', verificarToken, verificarAdmin, ventasController.cancelarVenta); // Nuevo
router.put('/estado/:idventa', verificarToken, verificarAdmin, ventasController.avanzarEstadoVenta);
router.get('/todas', verificarToken, verificarAdmin, ventasController.getTodasLasVentas); // Nuevo
router.get('/detalle/:idventa', verificarToken, verificarAdmin, ventasController.getDetalleVenta);
module.exports = router;
