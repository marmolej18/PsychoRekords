const express = require('express');
const router = express.Router();
const ventasController = require('../controladores/ventas.controlador');
const { verificarAdmin } = require('../middlewares/auth.middleware');

router.post('/', ventasController.crearVenta);
router.get('/usuario/:idUsuario', ventasController.getVentasByUsuario);
router.put('/cancelar/:idventa', verificarAdmin, ventasController.cancelarVenta); // Nuevo
router.get('/todas', verificarAdmin, ventasController.getTodasLasVentas); // Nuevo
module.exports = router;