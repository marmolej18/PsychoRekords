/// <reference types="jasmine" />

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CheckoutComponent } from './checkout.component';
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

    it('debería iniciar inválido hasta elegir cómo recibir el pedido', () => {
        expect(component.checkoutForm.valid).toBeFalse();
        component.checkoutForm.patchValue({ entrega: 'punto-2' });
        expect(component.checkoutForm.valid).toBeTrue();
    });

    it('en punto medio no pide dirección y el envío es gratis', () => {
        component.checkoutForm.patchValue({ entrega: 'punto-2' });
        expect(component.esDomicilio).toBeFalse();
        expect(component.checkoutForm.get('direccion')!.disabled).toBeTrue();
        expect(component.costoEnvio).toBe(0);
    });

    it('a domicilio pide la dirección y cobra la tarifa elegida', () => {
        component.tarifas = [{ idtarifa: 3, paqueteria: 'DHL', servicio: 'Nacional Económico', precio: 216, dias_min: 2, dias_max: 5 }];
        component.checkoutForm.patchValue({ entrega: 'tarifa-3' });
        expect(component.esDomicilio).toBeTrue();
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
        component.checkoutForm.patchValue({ entrega: 'punto-2' });
        // Act
        await component.confirmarCompra();
        // Assert
        expect(component.errorMessage).toContain('PayPal');
    });
});