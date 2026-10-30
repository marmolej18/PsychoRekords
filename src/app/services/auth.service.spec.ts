import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
    let httpSpy: jasmine.SpyObj<HttpClient>;
    let routerSpy: jasmine.SpyObj<Router>;
    const crearServicio = () => TestBed.inject(AuthService);
    const respuestaLogin = (rol?: string, token?: string) => ({
        message: 'ok',
        ...(token ? { token } : {}),
        usuario: { idUsuario: 5, nombre: 'Ana', correoElectronico: 'ana@test.com', ...(rol ? { rol } : {}) }
    });

    beforeEach(() => {
    localStorage.clear();
    httpSpy = jasmine.createSpyObj('HttpClient', ['post', 'get', 'put', 'delete']);
    routerSpy = jasmine.createSpyObj('Router', ['navigate']);
    TestBed.configureTestingModule({
        providers: [
            { provide: HttpClient, useValue: httpSpy },
            { provide: Router, useValue: routerSpy}
        ]
    });
    });

    afterEach(() => localStorage.clear());

    it('debería iniciar sin sesión', () => {
        const service = crearServicio();
        let logueado = true;
        service.isLoggedIn$.subscribe(v => (logueado = v));
        expect(logueado).toBeFalse();
        expect(service.getAuthHeader()).toBeNull();
    });

    it('login debería guardar la sesión y asignar rol "cliente" por defecto', () => {
        // Arrange
        const service = crearServicio();
        httpSpy.post.and.returnValue(of(respuestaLogin()));
        // Act
        service.login('ana@test.com', '1234').subscribe();
        // Assert
        expect(localStorage.getItem('currentUser')).toContain('"rol":"cliente"');
        expect(service.getAuthHeader()).toBe('5');
    });

    it('login debería guardar el token JWT cuando el backend lo devuelve', () => {
        // Arrange
        const service = crearServicio();
        httpSpy.post.and.returnValue(of(respuestaLogin('cliente', 'jwt-123')));
        // Act
        service.login('ana@test.com', '1234').subscribe();
        // Assert
        expect(service.getToken()).toBe('jwt-123');
    });

    it('login con rol admin debería activar isAdmin$', () => {
        // Arrange
        const service = crearServicio();
        httpSpy.post.and.returnValue(of(respuestaLogin('admin')));
        let esAdmin = false;
        service.isAdmin$.subscribe(v => (esAdmin = v));
        // Act
        service.login('ana@test.com', '1234').subscribe();
        // Assert
        expect(esAdmin).toBeTrue();
    });

    it('clearSession debería borrar la sesión pero conservar el carrito', () => {
        // Arrange
        const service = crearServicio();
        localStorage.setItem('tienda_carrito', '[]');
        httpSpy.post.and.returnValue(of(respuestaLogin('cliente', 'jwt-123')));
        service.login('ana@test.com', '1234').subscribe();
        // Act
        service.clearSession();
        // Assert
        let logueado = true;
        service.isLoggedIn$.subscribe(v => (logueado = v));
        expect(logueado).toBeFalse();
        expect(localStorage.getItem('currentUser')).toBeNull();
        expect(localStorage.getItem('auth_token')).toBeNull();
        expect(localStorage.getItem('tienda_carrito')).toBe('[]');
    });

    it('logout sin token debería limpiar la sesión y redirigir a /login', () => {
        // Arrange: sesión sin token (no hay nada que revocar en el backend)
        const service = crearServicio();
        httpSpy.post.and.returnValue(of(respuestaLogin()));
        service.login('ana@test.com', '1234').subscribe();
        // Act
        service.logout();
        // Assert
        expect(localStorage.getItem('currentUser')).toBeNull();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('debería restaurar la sesión guardada (usuario + token) al crearse', () => {
        // Arrange: simula recargar la página
        localStorage.setItem('auth_token', 'jwt-abc');
        localStorage.setItem('currentUser', JSON.stringify({
        idUsuario: 9, nombre: 'Luis', correoElectronico: 'luis@test.com', rol: 'admin'
        }));
        // Act
        const service = crearServicio();
        // Assert
        let esAdmin = false;
        service.isAdmin$.subscribe(v => (esAdmin = v));
        expect(esAdmin).toBeTrue();
        expect(service.getAuthHeader()).toBe('9');
    });

    it('NO debería restaurar la sesión si falta el token', () => {
        // Arrange: usuario guardado pero sin JWT
        localStorage.setItem('currentUser', JSON.stringify({
        idUsuario: 9, nombre: 'Luis', correoElectronico: 'luis@test.com', rol: 'admin'
        }));
        // Act
        const service = crearServicio();
        // Assert
        expect(service.getAuthHeader()).toBeNull();
        expect(localStorage.getItem('currentUser')).toBeNull();
    });
});
