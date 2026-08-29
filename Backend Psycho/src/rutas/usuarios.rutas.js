const express = require('express');
const router = express.Router();
const usuariosController = require('../controladores/usuarios.controlador');
const { verificarAdmin } = require('../middlewares/auth.middleware');

router.post('/registro', usuariosController.registrarUsuario);
router.get('/:id', usuariosController.getUsuarioById);
router.post('/login', usuariosController.loginUsuario);

router.get('/', verificarAdmin, usuariosController.getAllUsers);
router.put('/:id', verificarAdmin, usuariosController.updateUser);
router.delete('/:id', verificarAdmin, usuariosController.deleteUser);

module.exports = router;