import { TestBed } from '@angular/core/testing';
import { CarritoService } from './carrito.service';
import { Producto } from './productos.service';

describe('Integración: CarritoService + localStorage', () => {
    const discoA = { idprod: 1, titulo: 'Disco A', precio: 100, cantstock: 10 } as Producto;
    const discoB = { idprod: 2, titulo: 'Disco B', precio: 50, cantstock: 10 } as Producto;

    beforeEach(() => {
        localStorage.clear();
        TestBed.configureTestingModule({});
    });

    afterEach(() => localStorage.clear());

    // Simula recargar la página: destruye el servicio y crea uno nuevo
    const recargarServicio = (): CarritoService => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({});
        return TestBed.inject(CarritoService);
    };

    it('el carrito debería persistir tras recargar la aplicación', () => {
        const antes = TestBed.inject(CarritoService);
        antes.agregarProducto(discoA, 2);
        antes.agregarProducto(discoB);

        const despues = recargarServicio();

        expect(despues.getItems().length).toBe(2);
        expect(despues.getItemCount()).toBe(3);
    });

    it('vaciar el carrito debería quedar guardado tras recargar', () => {
        const antes = TestBed.inject(CarritoService);
        antes.agregarProducto(discoA);
        antes.vaciarCarrito();

        const despues = recargarServicio();

        expect(despues.getItems()).toEqual([]);
    });

    it('el subtotal debería recalcularse con los datos recuperados', () => {
        const antes = TestBed.inject(CarritoService);
        antes.agregarProducto(discoA, 2); // 200
        antes.agregarProducto(discoB, 2); // 100

        const despues = recargarServicio();
        let subtotal = 0;
        despues.getSubtotal().subscribe(s => (subtotal = s));

        expect(subtotal).toBe(300);
    });

    it('el límite de stock debería respetarse y conservarse tras recargar', () => {
        const antes = TestBed.inject(CarritoService);
        const pocoStock = { idprod: 3, titulo: 'Disco C', precio: 80, cantstock: 2 } as Producto;
        antes.agregarProducto(pocoStock, 5); // pide 5, solo hay 2

        const despues = recargarServicio();

        expect(despues.getItems()[0].cantidad).toBe(2);
        expect(despues.getItemCount()).toBe(2);
    });
});