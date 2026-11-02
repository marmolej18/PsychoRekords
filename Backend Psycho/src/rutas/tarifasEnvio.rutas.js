const express = require('express');
const router = express.Router();
const puntosEntregaController = require('../controladores/puntosEntrega.controlador');

router.get('/', puntosEntregaController.getTarifasEnvio);

module.exports = router;
