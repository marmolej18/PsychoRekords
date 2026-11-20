const express = require('express');
const router = express.Router();
router.param('idventa', (req, res, next, value) => { if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) return res.status(400).json({ message: 'Identificador inválido.' }); next(); });
const pagosController = require('../controladores/pagos.controlador');
const { verificarToken } = require('../middlewares/auth.middleware');

router.post('/confirmar/:idventa', verificarToken, pagosController.confirmarPago);

module.exports = router;
