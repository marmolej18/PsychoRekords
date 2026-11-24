const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

// Almacenamiento de portadas en una carpeta local del backend, servida en /uploads/portadas.
// Para producción en la nube (donde el disco se borra en cada despliegue) basta con reemplazar
// guardarPortada y eliminarPortada por versiones que usen un bucket (Cloudinary, S3, etc.);
// el resto del código solo guarda y muestra la URL que estas funciones devuelven.
const CARPETA_UPLOADS = path.resolve(__dirname, '../../uploads');
const CARPETA_PORTADAS = path.join(CARPETA_UPLOADS, 'portadas');
const RUTA_PUBLICA = '/uploads/portadas/';

// Se identifica el tipo por los primeros bytes del archivo, no por su nombre ni por lo que diga el navegador.
const FIRMAS = [
    { ext: 'jpg', esDeEsteTipo: b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    { ext: 'png', esDeEsteTipo: b => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
    { ext: 'webp', esDeEsteTipo: b => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' }
];

/** Extensión real de la imagen (jpg, png o webp), o null si el archivo no es una de ellas. */
function tipoDeImagen(buffer) {
    return FIRMAS.find(f => f.esDeEsteTipo(buffer))?.ext ?? null;
}

/** Guarda la imagen con un nombre aleatorio y devuelve su ruta pública (p. ej. /uploads/portadas/abc.jpg). */
async function guardarPortada(buffer, ext) {
    await fs.mkdir(CARPETA_PORTADAS, { recursive: true });
    const nombre = `${crypto.randomUUID()}.${ext}`;
    await fs.writeFile(path.join(CARPETA_PORTADAS, nombre), buffer);
    return RUTA_PUBLICA + nombre;
}

/** Borra una portada guardada antes; ignora rutas que no sean de esta carpeta. */
async function eliminarPortada(url) {
    if (typeof url !== 'string' || !url.startsWith(RUTA_PUBLICA)) return;
    const nombre = path.basename(url);
    await fs.unlink(path.join(CARPETA_PORTADAS, nombre)).catch(() => { /* ya no existía */ });
}

module.exports = { CARPETA_UPLOADS, tipoDeImagen, guardarPortada, eliminarPortada };
