const idValido = value => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value)) && Number(value) > 0;
const texto = (v, max, obligatorio = false) => v == null ? !obligatorio : typeof v === 'string' && v.length <= max && (!obligatorio || v.trim().length > 0);
const email = v => texto(v, 100, true) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
function validarDatos(req, res, next) {
    for (const [key, value] of Object.entries(req.params)) {
        if (key.toLowerCase().startsWith('id') && !idValido(value)) return res.status(400).json({ message: 'Identificador inválido.' });
    }
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && (!req.body || typeof req.body !== 'object' || Array.isArray(req.body))) return res.status(400).json({ message: 'Se requiere un objeto JSON.' });
    next();
}
function validarUsuario(req, res, next) {
    const b = req.body;
    if (!email(b.correoElectronico) || !texto(b.nombre, 50, true) || !texto(b.apellidoP, 50, true)) return res.status(400).json({ message: 'Revisa el nombre, apellido y correo electrónico.' });
    const campos = { apellidoM: 50, telefono: 20, CP: 10, calle: 100, colonia: 100, numCasa: 20, ciudad: 50, estado: 50 };
    if (Object.entries(campos).some(([k, max]) => !texto(b[k], max))) return res.status(400).json({ message: 'Los datos del perfil exceden la longitud permitida.' });
    if (req.method === 'POST' && (typeof b.password !== 'string' || b.password.length < 8 || Buffer.byteLength(b.password) > 256)) return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres y máximo 256 bytes.' });
    if (req.method === 'PUT' && !['admin', 'cliente'].includes(b.rol)) return res.status(400).json({ message: 'Rol inválido.' });
    next();
}
function validarProducto(req, res, next) {
    const b = req.body;
    const requerido = req.method === 'POST';
    const campos = { titulo: 100, artista: 100, generomus: 50, condiciones: 50 };
    const invalido = Object.entries(campos).some(([k, max]) => !texto(b[k], max, requerido && ['titulo','artista'].includes(k)));
    const precio = b.precio == null ? !requerido : ['number','string'].includes(typeof b.precio) && /^\d+(\.\d{1,2})?$/.test(String(b.precio)) && Number(b.precio) <= 99999999.99;
    if (invalido || !precio || (b.cantstock != null && (!Number.isSafeInteger(b.cantstock) || b.cantstock < 0)) || (b.formato != null && !['Vinilo','CD','Cassette'].includes(b.formato)) || (b.aniolanzam != null && (!Number.isInteger(b.aniolanzam) || b.aniolanzam < 0 || b.aniolanzam > 9999))) return res.status(400).json({ message: 'Revisa los datos del producto, precio e inventario.' });
    next();
}
module.exports = { validarDatos, validarUsuario, validarProducto, email };
