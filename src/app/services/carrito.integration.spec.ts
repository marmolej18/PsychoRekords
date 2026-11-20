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

    it('cada usuario debería tener su propio carrito', () => {
        const carrito = TestBed.inject(CarritoService);
        carrito.cambiarUsuario(5);
        carrito.agregarProducto(discoA, 2);
        carrito.cambiarUsuario(null);   // cierra sesión
        carrito.cambiarUsuario(8);      // entra otra persona en el mismo navegador

        expect(carrito.getItems()).toEqual([]);

        carrito.cambiarUsuario(null);
        carrito.cambiarUsuario(5);      // vuelve el primero: recupera su carrito
        expect(carrito.getItemCount()).toBe(2);
        expect(localStorage.getItem('tienda_carrito_5')).toContain('Disco A');
    });

    it('al cerrar sesión el carrito queda guardado pero ya no se muestra', () => {
        const carrito = TestBed.inject(CarritoService);
        carrito.cambiarUsuario(5);
        carrito.agregarProducto(discoA);
        carrito.cambiarUsuario(null);

        expect(carrito.getItems()).toEqual([]);
        expect(carrito.getItemCount()).toBe(0);
    });

    it('lo agregado como invitado debería sumarse al carrito del usuario al iniciar sesión', () => {
        localStorage.setItem('tienda_carrito_5', JSON.stringify([{ producto: discoA, cantidad: 1 }]));
        const carrito = TestBed.inject(CarritoService);
        carrito.agregarProducto(discoA, 2); // como invitado
        carrito.agregarProducto(discoB);

        carrito.cambiarUsuario(5);

        expect(carrito.getItems().find(i => i.producto.idprod === 1)?.cantidad).toBe(3);
        expect(carrito.getItemCount()).toBe(4);
        expect(localStorage.getItem('tienda_carrito')).toBeNull();
    });

    it('al sumar el carrito de invitado debería respetar el stock', () => {
        const pocoStock = { idprod: 3, titulo: 'Disco C', precio: 80, cantstock: 2 } as Producto;
        localStorage.setItem('tienda_carrito_5', JSON.stringify([{ producto: pocoStock, cantidad: 2 }]));
        const carrito = TestBed.inject(CarritoService);
        carrito.agregarProducto(pocoStock, 2);

        carrito.cambiarUsuario(5);

        expect(carrito.getItems()[0].cantidad).toBe(2);
    });

    it('el carrito de cada usuario debería persistir tras recargar', () => {
        const antes = TestBed.inject(CarritoService);
        antes.cambiarUsuario(5);
        antes.agregarProducto(discoB, 3);

        const despues = recargarServicio();
        despues.cambiarUsuario(5);

        expect(despues.getItemCount()).toBe(3);
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