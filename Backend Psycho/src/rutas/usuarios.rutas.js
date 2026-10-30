const express = require('express');
const router = express.Router();
const usuariosController = require('../controladores/usuarios.controlador');
const { verificarToken, verificarAdmin } = require('../middlewares/auth.middleware');

// Rutas públicas (no requieren autenticación)
router.post('/registro', usuariosController.registrarUsuario);
router.post('/login', usuariosController.loginUsuario);

// Ruta protegida para usuarios autenticados (invalida el JWT actual)
router.post('/logout', verificarToken, usuariosController.logoutUsuario);

// Consulta de perfil por ID
router.get('/:id', verificarToken, usuariosController.getUsuarioById);

// Rutas protegidas solo para administradores
// Se encadenan: primero se valida el token y luego se verifica el rol de admin
router.get('/', verificarToken, verificarAdmin, usuariosController.getAllUsers);
router.put('/:id', verificarToken, verificarAdmin, usuariosController.updateUser);
router.delete('/:id', verificarToken, verificarAdmin, usuariosController.deleteUser);

module.exports = router;