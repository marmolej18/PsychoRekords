-- Tabla USUARIO
CREATE TABLE Usuario (
    idUsuario SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    apellidoP VARCHAR(50) NOT NULL,
    apellidoM VARCHAR(50),
    correoElectronico VARCHAR(100) UNIQUE NOT NULL,
    telefono VARCHAR(20),
    CP VARCHAR(10),
    calle VARCHAR(100),
    colonia VARCHAR(100),
    numCasa VARCHAR(20),
    ciudad VARCHAR(50),
    estado VARCHAR(50),
    rol VARCHAR(50) NOT NULL DEFAULT 'cliente',
    password VARCHAR(100) NOT NULL DEFAULT 'password'
);

--Tabla PRODUCTO
CREATE TABLE Producto (
    idProd SERIAL PRIMARY KEY,
    titulo VARCHAR(100) NOT NULL,
    artista VARCHAR(100) NOT NULL,
    generoMus VARCHAR(50),
    anioLanzam INT,
    formato VARCHAR(20) CHECK (formato IN ('Vinilo', 'CD', 'Cassette')), -- Validación simple
    condiciones VARCHAR(50), -- Ej: Nuevo, Usado, Seminuevo
    cantStock INT DEFAULT 0,
    precio NUMERIC(10, 2) NOT NULL -- Importante para guardar el precio (10 dígitos, 2 decimales)
);

--Creación de la Tabla PUNTO_ENTREGA (NUEVA)
CREATE TABLE PuntoEntrega (
    idPunto SERIAL PRIMARY KEY,
    nombrePunto VARCHAR(50) NOT NULL, -- Ej: Sucursal Centro
    direccionCompleta TEXT NOT NULL,
    referencias TEXT,
    horarioAtencion VARCHAR(100)
);

--Tabla VENTA (Cabecera del pedido)
CREATE TABLE Venta (
    idVenta SERIAL PRIMARY KEY,
    idUsuario INT NOT NULL,
    idPunto INT NOT NULL, -- Aquí guardamos dónde recogerá el producto
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Se guarda la fecha/hora actual automáticamente
    totalVenta NUMERIC(10, 2) DEFAULT 0.00,
    estadoPedido VARCHAR(20) DEFAULT 'Pagado', -- Ej: Pagado, Entregado, Cancelado
    
    -- Relaciones (Llaves Foráneas)
    CONSTRAINT fk_venta_usuario FOREIGN KEY (idUsuario) REFERENCES Usuario(idUsuario),
    CONSTRAINT fk_venta_punto FOREIGN KEY (idPunto) REFERENCES PuntoEntrega(idPunto)
);

-- 6. Creación de la Tabla DETALLE_VENTA (Los productos del carrito)
CREATE TABLE DetalleVenta (
    idDetalle SERIAL PRIMARY KEY,
    idVenta INT NOT NULL,
    idProd INT NOT NULL,
    cantidad INT NOT NULL,
    precioUnitario NUMERIC(10, 2) NOT NULL, -- Precio al momento de la compra
    
    -- Relaciones
    CONSTRAINT fk_detalle_venta FOREIGN KEY (idVenta) REFERENCES Venta(idVenta),
    CONSTRAINT fk_detalle_producto FOREIGN KEY (idProd) REFERENCES Producto(idProd)
);

-- --- DATOS DE EJEMPLO (OPCIONALES PARA PROBAR) ---

-- Insertar un Punto de Entrega
INSERT INTO PuntoEntrega (nombrePunto, direccionCompleta, horarioAtencion) 
VALUES ('Plaza Central', 'Av. Madero 123, Centro', 'Lun-Sab 10am-8pm');

-- Insertar un Producto
INSERT INTO Producto (titulo, artista, generoMus, anioLanzam, formato, condiciones, cantStock, precio) 
VALUES ('Abbey Road', 'The Beatles', 'Rock', 1969, 'Vinilo', 'Nuevo', 10, 550.00);

-- Insertar un Usuario
INSERT INTO Usuario (nombre, apellidoP, correoElectronico) 
VALUES ('Juan', 'Perez', 'juan@email.com');

INSERT INTO Usuario (nombre, apellidoP, correoElectronico, "password", rol) 
VALUES ('Enrique', 'Amador', 'kike@email.com', 'admin', 'admin');

INSERT INTO Usuario (nombre, apellidoP, correoElectronico, "password", rol) 
VALUES ('Enrique', 'Macias', 'kike2@email.com', 'admin', 'user');


INSERT INTO Usuario (nombre, apellidoP, correoElectronico, "password", rol) 
VALUES ('Kim', 'Marmolejo', 'kim@email.com', 'admin', 'admin');

CREATE OR REPLACE VIEW vw_historial_ventas AS
SELECT 
    V."idventa", 
    V."idusuario", -- Mantener el idusuario para poder filtrar
    V."fecha", 
    V."totalventa", 
    V."estadopedido",
    PE."nombrepunto", 
    PE."direccioncompleta",
    json_agg(
        json_build_object(
            'iddetalle', DV."iddetalle",
            'titulo', P."titulo",
            'artista', P."artista",
            'cantidad', DV."cantidad",
            'precioUnitario', DV."preciounitario"
        )
    ) AS detalles
FROM "venta" V
JOIN "puntoentrega" PE ON V."idpunto" = PE."idpunto"
JOIN "detalleventa" DV ON V."idventa" = DV."idventa"
JOIN "producto" P ON DV."idprod" = P."idprod"
GROUP BY 
    V."idventa", 
    V."idusuario",
    PE."idpunto"
ORDER BY V."fecha" DESC;

CREATE OR REPLACE VIEW vw_productos_rentables AS
SELECT
    P.idprod,
    P.titulo,
    P.artista,
    P.formato,
    P.precio AS precio_catalogo_actual,
    SUM(DV.cantidad) AS total_unidades_vendidas,
    SUM(DV.cantidad * DV.preciounitario) AS total_ingreso_generado
FROM
    producto P
JOIN
    detalleventa DV ON P.idprod = DV.idprod
GROUP BY
    P.idprod,
    P.titulo,
    P.artista,
    P.formato,
    P.precio
ORDER BY
    total_unidades_vendidas DESC, total_ingreso_generado DESC;

CREATE OR REPLACE VIEW vw_ventas_por_formato AS
SELECT
    -- Agrupamos por Artista y Formato. El ROLLUP generará filas NULL para los subtotales.
    P.artista,
    P.formato,
    COUNT(DISTINCT V.idventa) AS total_ordenes,
    SUM(DV.cantidad) AS total_unidades_vendidas,
    SUM(DV.cantidad * DV.preciounitario) AS ingreso_bruto
FROM
    venta V
JOIN
    detalleventa DV ON V.idventa = DV.idventa
JOIN
    producto P ON DV.idprod = P.idprod
GROUP BY
    ROLLUP(P.artista, P.formato) -- ¡La clave para subtotales!
ORDER BY
    P.artista NULLS LAST, -- Pone el total general al final del artista
    P.formato NULLS LAST;


-- Función de Procedimiento para Cancelar una Venta y Revertir el Inventario
-- Debe ejecutarse desde el backend de Node.js
CREATE OR REPLACE PROCEDURE sp_cancelar_venta(
    p_id_venta INT,
    p_id_usuario_admin INT  -- Quién realiza la cancelación (para auditoría)
)
LANGUAGE plpgsql
AS $$
DECLARE
    -- Cursor para obtener los productos y cantidades de la venta
    c_detalles CURSOR FOR
        SELECT idprod, cantidad 
        FROM detalleventa 
        WHERE idventa = p_id_venta;

    v_id_prod INT;
    v_cantidad_devuelta INT;
    v_estado_actual VARCHAR(50);

BEGIN
    -- 1. Iniciar Transacción (PL/pgSQL maneja el COMMIT/ROLLBACK implícitamente en el bloque)
    
    -- 2. Verificar el estado actual de la venta
    SELECT estadopedido INTO v_estado_actual 
    FROM venta 
    WHERE idventa = p_id_venta;

    IF v_estado_actual IS NULL THEN
        RAISE EXCEPTION 'ERROR: Venta % no encontrada.', p_id_venta;
    ELSIF v_estado_actual = 'CANCELADO' THEN
        RAISE EXCEPTION 'ERROR: Venta % ya ha sido cancelada.', p_id_venta;
    END IF;

    -- 3. Recorrer los detalles de la venta y revertir el stock (USO DE CURSOR)
    OPEN c_detalles;
    
    LOOP
        FETCH c_detalles INTO v_id_prod, v_cantidad_devuelta;
        EXIT WHEN NOT FOUND;

        -- Devolver la cantidad al inventario (UPDATE)
        UPDATE producto
        SET cantstock = cantstock + v_cantidad_devuelta
        WHERE idprod = v_id_prod;

        -- (Opcional: Si implementaste un LOG, podrías insertar aquí el registro de devolución)

    END LOOP;
    
    CLOSE c_detalles;

    -- 4. Marcar la venta como CANCELADA (Importante: NO la eliminamos, solo cambiamos el estado)
    -- Si la eliminas (DELETE), pierdes la trazabilidad financiera.
    UPDATE venta
    SET estadopedido = 'CANCELADO', 
        -- Podrías añadir un campo 'fecha_cancelacion' = NOW()
        totalventa = 0 -- Se anula el valor financiero de la orden
    WHERE idventa = p_id_venta;

    -- 5. Mensaje de éxito (implícito)
    RAISE NOTICE 'Venta % cancelada y stock revertido con éxito.', p_id_venta;

EXCEPTION
    WHEN OTHERS THEN
        -- Si algo falla (ej. RAISE EXCEPTION), se hará un ROLLBACK automático
        RAISE EXCEPTION 'Falló la cancelación de la venta %: %', p_id_venta, SQLERRM;
END;
$$;


SELECT * FROM puntoentrega WHERE idpunto = 1;

SELECT idventa, nombrepunto, direccioncompleta, estadopedido FROM vw_historial_ventas;
SELECT * FROM puntoentrega WHERE nombrepunto = '*****';


-- FUNCIÓN TRIGGER: Se ejecuta después de actualizar la tabla "venta"
CREATE OR REPLACE FUNCTION fn_anular_venta_reporte()
RETURNS TRIGGER AS $$
BEGIN
    -- Verificar si el cambio es de cualquier estado a CANCELADO
    -- Esto garantiza que solo se active una vez.
    IF OLD.estadopedido != 'CANCELADO' AND NEW.estadopedido = 'CANCELADO' THEN
        
        -- Insertar los detalles originales de la venta, pero con una CANTIDAD NEGATIVA.
        -- Esto anula el impacto en los reportes basados en SUM(detalleventa.cantidad).
        INSERT INTO detalleventa (idventa, idprod, cantidad, preciounitario)
        SELECT 
            NEW.idventa,        -- El ID de la venta cancelada
            idprod,             
            -cantidad,          -- Cantidad negativa para la anulación
            preciounitario
        FROM detalleventa
        WHERE idventa = NEW.idventa AND cantidad > 0; -- Solo aplicar a las filas de venta originales

    END IF;
    
    RETURN NEW; -- Continuar con la operación de UPDATE
END;
$$ LANGUAGE plpgsql;


-- TRIGGER: Se activa al actualizar el estado de una venta (por el procedimiento sp_cancelar_venta)
CREATE OR REPLACE TRIGGER tr_anular_venta_reporte
AFTER UPDATE ON venta
FOR EACH ROW
EXECUTE FUNCTION fn_anular_venta_reporte();


UPDATE producto p
SET cantstock = p.cantstock + (
    SELECT COALESCE(SUM(dv.cantidad), 0)
    FROM detalleventa dv
    WHERE dv.idprod = p.idprod
      AND dv.cantidad > 0 -- Solo sumamos las ventas, no las anulaciones
);

-- 2. Poner todas las ventas en estado "Pagado".
UPDATE venta
SET estadopedido = 'Pagado',
    totalventa = (
        SELECT COALESCE(SUM(dv.cantidad * dv.preciounitario), 0)
        FROM detalleventa dv
        WHERE dv.idventa = venta.idventa
          AND dv.cantidad > 0 -- Volver a calcular el total sin considerar anulaciones
    )
WHERE estadopedido != 'Pagado'; -- Aplicar solo a las canceladas/entregadas

-- 3. Eliminar cualquier fila de anulación si usaste el Trigger (cantidad negativa).
DELETE FROM detalleventa
WHERE cantidad < 0;


-- Query para obtener el movimiento neto de productos
SELECT
    p.idprod,
    p.titulo AS nombre_producto,
    SUM(CASE WHEN dv.cantidad > 0 THEN dv.cantidad ELSE 0 END) AS unidades_vendidas, -- Suma solo positivos (ventas originales)
    SUM(CASE WHEN dv.cantidad < 0 THEN -dv.cantidad ELSE 0 END) AS unidades_anuladas, -- Suma solo el valor absoluto de negativos (anulaciones)
    SUM(dv.cantidad) AS movimiento_neto -- Impacto real en reportes (0 si se anula totalmente)
FROM detalleventa dv
JOIN producto p ON dv.idprod = p.idprod
GROUP BY p.idprod, p.titulo
ORDER BY unidades_vendidas DESC;


CREATE TABLE log_auditoria_stock (
    id_log SERIAL PRIMARY KEY,
    id_prod INT NOT NULL,
    fecha_cambio TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
    stock_anterior INT,
    stock_nuevo INT,
    -- Podrías añadir un campo para saber quién hizo el cambio, si tu arquitectura lo permite
    -- usuario_afectado INT 
    FOREIGN KEY (id_prod) REFERENCES producto(idprod)
);


CREATE OR REPLACE FUNCTION fn_auditar_stock()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo auditar si el valor de cantstock realmente cambió entre el viejo (OLD) y el nuevo (NEW) registro
    IF OLD.cantstock IS DISTINCT FROM NEW.cantstock THEN
        INSERT INTO log_auditoria_stock (
            id_prod, 
            stock_anterior, 
            stock_nuevo
        )
        VALUES (
            NEW.idprod, 
            OLD.cantstock, 
            NEW.cantstock
        );
    END IF;
    
    RETURN NEW; 
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE TRIGGER tr_auditoria_stock
AFTER UPDATE ON producto
FOR EACH ROW
EXECUTE FUNCTION fn_auditar_stock();

-- Creacion de Indice en tabla producto y columna cantstock
CREATE OR REPLACE INDEX idx_cantstock ON producto(cantstock);


 
-- Función: verificar_correo_existente
-- Retorna TRUE si el correo ya está en uso por otro ID, FALSE si está disponible.
CREATE OR REPLACE FUNCTION verificar_correo_existente(
    p_correo_electronico TEXT,
    p_id_usuario_excluir INT DEFAULT NULL -- ID que puede poseer el correo (usado en PUT/Update)
)
RETURNS BOOLEAN AS $$
DECLARE
    v_existe BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 
        FROM "usuario" u
        WHERE u."correoelectronico" = p_correo_electronico
          -- Excluir el propio ID si se está actualizando
          AND u."idusuario" != COALESCE(p_id_usuario_excluir, 0)
    ) INTO v_existe;

    RETURN v_existe;
END;
$$ LANGUAGE plpgsql;

-- Función: verificar_stock_disponible
-- Verifica si hay suficiente stock para un producto dado.
-- Si no hay suficiente stock, lanza una excepción que puede ser capturada por el backend.

CREATE OR REPLACE FUNCTION verificar_stock_disponible(
    p_id_prod INT,
    p_cantidad_requerida INT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_stock_actual INT;
    v_producto_titulo TEXT;
BEGIN
    -- 1. Obtener el stock actual y el título del producto
    SELECT "cantstock", titulo 
    INTO v_stock_actual, v_producto_titulo
    FROM "producto" 
    WHERE "idprod" = p_id_prod;

    -- 2. Verificar si el producto existe
    IF v_stock_actual IS NULL THEN
        RAISE EXCEPTION 'Producto con ID % no encontrado.', p_id_prod;
    END IF;

    -- 3. Verificar el stock
    IF v_stock_actual < p_cantidad_requerida THEN
        -- Lanzar una excepción con un mensaje detallado
        RAISE EXCEPTION 'Stock insuficiente para "%". Stock disponible: %, Requerido: %.',
        v_producto_titulo, v_stock_actual, p_cantidad_requerida;
    END IF;

    -- Si todo es correcto, retorna TRUE
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;