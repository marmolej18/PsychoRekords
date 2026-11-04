const express = require('express');
const router = express.Router();
router.param('id', (req, res, next, value) => { if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) return res.status(400).json({ message: 'Identificador inválido.' }); next(); });
const { validarDatos, validarUsuario } = require('../middlewares/validacion');
const { loginLimit } = require('../middlewares/loginLimit');
router.use(validarDatos);
const usuariosController = require('../controladores/usuarios.controlador');
const { verificarToken, verificarAdmin } = require('../middlewares/auth.middleware');

// Rutas públicas (no requieren autenticación)
router.post('/registro', validarUsuario, usuariosController.registrarUsuario);
router.post('/login', loginLimit, usuariosController.loginUsuario);

// Ruta protegida para usuarios autenticados (invalida el JWT actual)
router.post('/logout', verificarToken, usuariosController.logoutUsuario);

// Consulta de perfil por ID
router.get('/:id', verificarToken, usuariosController.getUsuarioById);

// Rutas protegidas solo para administradores
// Se encadenan: primero se valida el token y luego se verifica el rol de admin
router.get('/', verificarToken, verificarAdmin, usuariosController.getAllUsers);
router.put('/:id', verificarToken, verificarAdmin, validarUsuario, usuariosController.updateUser);
router.delete('/:id', verificarToken, verificarAdmin, usuariosController.deleteUser);

module.exports = router;