import { TestBed } from '@angular/core/testing';
import { CarritoService } from './carrito.service';
import { Producto } from './productos.service';

describe('CarritoService (prueba unitaria)', () => {
  let service: CarritoService;
  const discoA = { idprod: 1, titulo: 'Disco A', precio: 100 } as Producto;
  const discoB = { idprod: 2, titulo: 'Disco B', precio: 50 } as Producto;

  beforeEach(() => {
    localStorage.clear(); // evita que un test afecte a otro
    TestBed.configureTestingModule({});
    service = TestBed.inject(CarritoService);
  });

  afterEach(() => localStorage.clear());

  it('debería iniciar con el carrito vacío', () => {
    expect(service.getItems()).toEqual([]);
    expect(service.getItemCount()).toBe(0);
  });

  it('debería agregar un producto nuevo al carrito', () => {
    // Arrange: carrito vacío (beforeEach)
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
    // Arrange / Act
    service.agregarProducto(discoA, 2);
    service.agregarProducto(discoB, 3);
    // Assert
    expect(service.getItemCount()).toBe(5);
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
