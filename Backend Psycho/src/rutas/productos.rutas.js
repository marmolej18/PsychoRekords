const express = require('express');
const router = express.Router();
router.param('id', (req, res, next, value) => { if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) return res.status(400).json({ message: 'Identificador inválido.' }); next(); });
const multer = require('multer');
const { validarDatos, validarProducto } = require('../middlewares/validacion');
const productosController = require('../controladores/productos.controlador');
const { verificarToken, verificarAdmin } = require('../middlewares/auth.middleware');

// Portada del disco (Admin). Va antes de validarDatos porque llega como archivo (multipart), no como JSON.
// La imagen se queda en memoria (máx. 2 MB) y el controlador revisa que de verdad sea JPG, PNG o WEBP.
const recibirPortada = (req, res, next) => multer({ limits: { fileSize: 2 * 1024 * 1024, files: 1 } })
    .single('imagen')(req, res, error => {
        if (!error) return next();
        const message = error.code === 'LIMIT_FILE_SIZE' ? 'La portada no puede pesar más de 2 MB.' : 'No se pudo leer la imagen enviada.';
        res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ message });
    });
router.put('/:id/imagen', verificarToken, verificarAdmin, recibirPortada, productosController.subirImagen);

router.use(validarDatos);

// Rutas Publicas
router.get('/', productosController.getProductos);
router.get('/:id', productosController.getProductoById);

// Rutas Privadas (Admin)
router.post('/', verificarToken, verificarAdmin, validarProducto, productosController.crearProducto);
router.put('/:id', verificarToken, verificarAdmin, validarProducto, productosController.actualizarProducto);

module.exports = router;
