/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CheckoutComponent } from './checkout.component';
import { VentasService } from '../services/ventas.service';
import { TEST_PROVIDERS } from '../testing/test-providers';

describe('CheckoutComponent', () => {
    let component: CheckoutComponent;
    let fixture: ComponentFixture<CheckoutComponent>;

    beforeEach(async () => {
        // Arrange: sesión iniciada y carrito con un producto
        // (sin esto, ngOnInit redirige a /carrito y no crea el formulario)
        localStorage.clear();
        localStorage.setItem('auth_token', 'token-falso');
        localStorage.setItem('currentUser', JSON.stringify({
        idUsuario: 1, nombre: 'Ana', correoElectronico: 'ana@test.com', rol: 'cliente'
        }));
        localStorage.setItem('tienda_carrito', JSON.stringify([
        { producto: { idprod: 1, titulo: 'Disco A', precio: 100 }, cantidad: 1 }
        ]));

        await TestBed.configureTestingModule({
        imports: [CheckoutComponent],
        providers: [...TEST_PROVIDERS]
        }).compileComponents();

        fixture = TestBed.createComponent(CheckoutComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    afterEach(() => localStorage.clear());

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    const direccion = {
        destinatario: 'Ana López', telefono: '4491234567', calle: 'Av. Madero', numero: '123',
        colonia: 'Centro', cp: '20000', ciudad: 'Aguascalientes', estado: 'Aguascalientes'
    };

    const contacto = { correo: 'ana@test.com', telefono: '4491234567', referencias: 'Playera negra, entrada principal' };

    it('debería iniciar inválido hasta elegir cómo recibir el pedido', () => {
        expect(component.checkoutForm.valid).toBeFalse();
        component.checkoutForm.patchValue({ entrega: 'punto-2', contacto });
        expect(component.checkoutForm.valid).toBeTrue();
    });

    it('en punto medio no pide dirección, es gratis y exige correo, teléfono y referencias', () => {
        component.checkoutForm.patchValue({ entrega: 'punto-2' });
        expect(component.esDomicilio).toBeFalse();
        expect(component.esPuntoMedio).toBeTrue();
        expect(component.checkoutForm.get('direccion')!.disabled).toBeTrue();
        expect(component.costoEnvio).toBe(0);
        component.checkoutForm.patchValue({ contacto });
        expect(component.checkoutForm.valid).toBeTrue();
        for (const campo of ['correo', 'telefono', 'referencias']) {
            component.checkoutForm.patchValue({ contacto: { ...contacto, [campo]: '' } });
            expect(component.checkoutForm.valid).withContext(campo).toBeFalse();
        }
        component.checkoutForm.patchValue({ contacto: { ...contacto, correo: 'ana@' } });
        expect(component.checkoutForm.valid).toBeFalse();
    });

    it('a domicilio pide la dirección y cobra la tarifa elegida', () => {
        component.tarifas = [{ idtarifa: 3, paqueteria: 'DHL', servicio: 'Nacional Económico', precio: 216, dias_min: 2, dias_max: 5 }];
        component.checkoutForm.patchValue({ entrega: 'tarifa-3' });
        expect(component.esDomicilio).toBeTrue();
        expect(component.checkoutForm.get('contacto')!.disabled).toBeTrue();
        expect(component.costoEnvio).toBe(216);
        expect(component.checkoutForm.valid).toBeFalse();
        component.checkoutForm.patchValue({ direccion });
        expect(component.checkoutForm.valid).toBeTrue();
        component.checkoutForm.patchValue({ direccion: { cp: '2000' } });
        expect(component.checkoutForm.valid).toBeFalse();
        component.checkoutForm.patchValue({ direccion: { cp: '20000', telefono: '12345' } });
        expect(component.checkoutForm.valid).toBeFalse();
    });

    it('no debería confirmar la compra si no se completó el pago de PayPal', async () => {
        // Arrange
        component.checkoutForm.patchValue({ entrega: 'punto-2', contacto });
        // Act
        await component.confirmarCompra();
        // Assert
        expect(component.errorMessage).toContain('PayPal');
    });

    describe('pago con tarjeta (Stripe)', () => {
        let ventas: VentasService;
        let stripeFalso: { confirmCardPayment: jasmine.Spy };

        beforeEach(() => {
            ventas = TestBed.inject(VentasService);
            spyOn(ventas, 'crearVenta').and.returnValue(of({ idVenta: 7, clientSecret: 'pi_123_secret', totalVenta: 116 }));
            spyOn(ventas, 'confirmarPago').and.returnValue(of({ message: 'ok', idVenta: 7, estadopedido: 'Pagado' }));
            // Simula Stripe.js y su campo de tarjeta ya montados y con una tarjeta completa
            stripeFalso = { confirmCardPayment: jasmine.createSpy('confirmCardPayment').and.resolveTo({}) };
            Object.assign(component as any, { stripe: stripeFalso, campoTarjeta: { destroy: jasmine.createSpy('destroy') } });
            component.tarjetaCompleta = true;
            component.checkoutForm.patchValue({ entrega: 'punto-2', contacto, metodoPago: 'tarjeta' });
        });

        it('sin Stripe.js cargado, el método por defecto es PayPal', () => {
            expect(component.stripeDisponible).toBeFalse();
            expect(TestBed.createComponent(CheckoutComponent).componentInstance.stripeDisponible).toBeFalse();
        });

        it('crea la venta con tarjeta, cobra con Stripe y pide al backend confirmar el pago', async () => {
            await component.pagarConTarjeta();

            expect((ventas.crearVenta as jasmine.Spy).calls.mostRecent().args[0].metodoPago).toBe('tarjeta');
            expect(stripeFalso.confirmCardPayment).toHaveBeenCalledWith('pi_123_secret', jasmine.any(Object));
            expect(ventas.confirmarPago).toHaveBeenCalledWith(7);
            expect(component.purchaseComplete).toBeTrue();
            expect(component.ventaExitosaData).toEqual(jasmine.objectContaining({ idVenta: 7, totalVenta: 116 }));
        });

        it('si la tarjeta se rechaza, muestra el error y el reintento reutiliza la misma venta', async () => {
            stripeFalso.confirmCardPayment.and.resolveTo({ error: { message: 'Tu tarjeta fue rechazada.' } });
            await component.pagarConTarjeta();

            expect(component.errorMessage).toBe('Tu tarjeta fue rechazada.');
            expect(ventas.confirmarPago).not.toHaveBeenCalled();
            expect(component.purchaseComplete).toBeFalse();
            expect(component.checkoutForm.get('entrega')!.disabled).toBeTrue();

            stripeFalso.confirmCardPayment.and.resolveTo({});
            await component.pagarConTarjeta();
            expect(ventas.crearVenta).toHaveBeenCalledTimes(1);
            expect(component.purchaseComplete).toBeTrue();
        });

        it('OXXO: genera la ficha con Stripe y muestra el enlace, sin confirmar el pedido como pagado', async () => {
            (ventas.confirmarPago as jasmine.Spy).and.returnValue(of({
                message: 'ficha', idVenta: 7, estadopedido: 'Pendiente de pago',
                fichaUrl: 'https://payments.stripe.com/oxxo/voucher/abc', referencia: '123', vence: '2026-11-23T12:00:00Z'
            }));
            Object.assign(stripeFalso, { confirmOxxoPayment: jasmine.createSpy('confirmOxxoPayment').and.resolveTo({}) });
            Object.assign(component as any, { nombreCliente: 'Ana López', correoCliente: 'ana@test.com' });
            component.checkoutForm.patchValue({ metodoPago: 'oxxo' });

            await component.generarFichaOxxo();

            expect((ventas.crearVenta as jasmine.Spy).calls.mostRecent().args[0].metodoPago).toBe('oxxo');
            expect((stripeFalso as any).confirmOxxoPayment).toHaveBeenCalledWith('pi_123_secret',
                { payment_method: { billing_details: { name: 'Ana López', email: 'ana@test.com' } } });
            expect(component.purchaseComplete).toBeTrue();
            expect(component.ventaExitosaData.fichaUrl).toBe('https://payments.stripe.com/oxxo/voucher/abc');
            fixture.detectChanges();
            expect(fixture.nativeElement.textContent).toContain('ficha de pago en OXXO');
        });

        it('no cobra si los datos de la tarjeta están incompletos', async () => {
            component.tarjetaCompleta = false;
            await component.pagarConTarjeta();
            expect(ventas.crearVenta).not.toHaveBeenCalled();
            expect(component.errorMessage).toContain('tarjeta');
        });
    });
});