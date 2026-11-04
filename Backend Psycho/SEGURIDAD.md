# Seguridad del prototipo

Requiere Node.js 20 o posterior. Al iniciar `node src/server.js`, las contraseñas existentes se convierten a scrypt con sal aleatoria. La migración es transaccional e idempotente y elimina la contraseña por defecto de la tabla. Las cuentas conservan su contraseña; las nuevas requieren al menos ocho caracteres. La comparación del hash usa tiempo constante. Haz respaldo de la base antes de aplicar en otro equipo.

El login admite cinco intentos por IP/cuenta y treinta por IP en quince minutos; después responde 429 con Retry-After. Un acceso correcto libera el contador IP/cuenta. Los contadores son locales al proceso y se reinician con la API; no son un bloqueo distribuido.

La API valida perfiles, productos, identificadores y cantidades del carrito. Los precios se consultan en PostgreSQL y se calculan subtotal, IVA del 16% y envío en centavos. Se usa el usuario del JWT para registrar la venta; no se toma el identificador enviado por el navegador. Los precios de los detalles también se guardan desde la base.

PayPal conserva la demostración sandbox original del frontend, por solicitud del equipo. No hay verificación del pago en el backend: el estado Pagado del prototipo no acredita una transacción real verificada. La verificación de pagos queda pendiente.

Las pruebas nuevas están en pruebas-locales, ignoradas por Git. Las pruebas y el workflow anteriores del equipo se conservan. Esta entrega no incluye Helmet, monitoreo u otros cambios de permisos.
