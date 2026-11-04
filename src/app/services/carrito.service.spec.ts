import { TestBed } from '@angular/core/testing';
import { CarritoService } from './carrito.service';
import { Producto } from './productos.service';

describe('CarritoService (unitaria)', () => {
    let service: CarritoService;

    const discoA = { idprod: 1, titulo: 'Disco A', precio: 100, cantstock: 10 } as Producto;
    const discoB = { idprod: 2, titulo: 'Disco B', precio: 50, cantstock: 10 } as Producto;

    beforeEach(() => {
        localStorage.clear();
        TestBed.configureTestingModule({});
        service = TestBed.inject(CarritoService);
    });

    afterEach(() => localStorage.clear());

    it('debería iniciar con el carrito vacío', () => {
        expect(service.getItems()).toEqual([]);
        expect(service.getItemCount()).toBe(0);
    });

    it('debería agregar un producto nuevo al carrito', () => {
        // Act
        service.agregarProducto(discoA);
        // Assert
        expect(service.getItems().length).toBe(1);
        expect(service.getItems()[0].cantidad).toBe(1);
    });

    it('debería incrementar la cantidad si el producto ya existe', () => {
        // Arrange
        service.agregarProducto(discoA);
        // Act
        service.agregarProducto(discoA, 2);
        // Assert
        expect(service.getItems().length).toBe(1);
        expect(service.getItems()[0].cantidad).toBe(3);
    });

    it('debería actualizar el conteo total de ítems', () => {
        // Act
        service.agregarProducto(discoA, 2);
        service.agregarProducto(discoB, 3);
        // Assert
        expect(service.getItemCount()).toBe(5);
    });

    it('no debería permitir agregar más unidades que el stock disponible', () => {
        // Arrange
        const pocoStock = { idprod: 3, titulo: 'Disco C', precio: 80, cantstock: 2 } as Producto;
        // Act
        service.agregarProducto(pocoStock, 5);
        // Assert
        expect(service.getItems()[0].cantidad).toBe(2);
    });

    it('actualizarCantidad debería cambiar las unidades de un producto', () => {
        // Arrange
        service.agregarProducto(discoA);
        // Act
        service.actualizarCantidad(1, 4);
        // Assert
        expect(service.getItems()[0].cantidad).toBe(4);
    });

    it('actualizarCantidad con 0 debería eliminar el producto', () => {
        // Arrange
        service.agregarProducto(discoA);
        // Act
        service.actualizarCantidad(1, 0);
        // Assert
        expect(service.getItems()).toEqual([]);
    });

    it('debería eliminar un producto por su id', () => {
        // Arrange
        service.agregarProducto(discoA);
        service.agregarProducto(discoB);
        // Act
        service.eliminarProducto(1);
        // Assert
        expect(service.getItems().length).toBe(1);
        expect(service.getItems()[0].producto.idprod).toBe(2);
    });

    it('debería vaciar el carrito', () => {
        // Arrange
        service.agregarProducto(discoA);
        // Act
        service.vaciarCarrito();
        // Assert
        expect(service.getItems()).toEqual([]);
        expect(service.getItemCount()).toBe(0);
    });

    it('debería calcular el subtotal correctamente', () => {
        // Arrange: 100*2 + 50*1 = 250
        service.agregarProducto(discoA, 2);
        service.agregarProducto(discoB, 1);
        // Act
        let subtotal = 0;
        service.getSubtotal().subscribe(s => (subtotal = s));
        // Assert
        expect(subtotal).toBe(250);
    });
});