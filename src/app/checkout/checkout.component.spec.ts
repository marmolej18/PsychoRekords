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

    it('debería iniciar el formulario inválido hasta elegir un punto de entrega', () => {
        expect(component.checkoutForm.valid).toBeFalse();
        component.checkoutForm.patchValue({ idpunto: 1 });
        expect(component.checkoutForm.valid).toBeTrue();
    });

    it('no debería confirmar la compra si no se completó el pago de PayPal', async () => {
        // Arrange
        component.checkoutForm.patchValue({ idpunto: 1 });
        // Act
        await component.confirmarCompra();
        // Assert
        expect(component.errorMessage).toContain('PayPal');
    });
});