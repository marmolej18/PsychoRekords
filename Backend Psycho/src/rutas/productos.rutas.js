const express = require('express');
const router = express.Router();
router.param('id', (req, res, next, value) => { if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) return res.status(400).json({ message: 'Identificador inválido.' }); next(); });
const { validarDatos, validarProducto } = require('../middlewares/validacion');
router.use(validarDatos);
const productosController = require('../controladores/productos.controlador');
const { verificarToken, verificarAdmin } = require('../middlewares/auth.middleware');

// Rutas Publicas
router.get('/', productosController.getProductos);
router.get('/:id', productosController.getProductoById);

// Rutas Privadas (Admin)
router.post('/', verificarToken, verificarAdmin, validarProducto, productosController.crearProducto);
router.put('/:id', verificarToken, verificarAdmin, validarProducto, productosController.actualizarProducto);

module.exports = router;
