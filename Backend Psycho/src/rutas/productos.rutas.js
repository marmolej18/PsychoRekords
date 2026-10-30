const express = require('express');
const router = express.Router();
const productosController = require('../controladores/productos.controlador');
const { verificarToken, verificarAdmin } = require('../middlewares/auth.middleware');

// Rutas Publicas
router.get('/', productosController.getProductos);
router.get('/:id', productosController.getProductoById);

// Rutas Privadas (Admin)
router.post('/', verificarToken, verificarAdmin, productosController.crearProducto);
router.put('/:id', verificarToken, verificarAdmin, productosController.actualizarProducto);

module.exports = router;
