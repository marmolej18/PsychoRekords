import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';

describe('Integración: AuthService + HttpClient', () => {
    let service: AuthService;
    let http: HttpTestingController;
    let routerSpy: jasmine.SpyObj<Router>;
    const API = 'http://localhost:3000/api/usuarios';

    beforeEach(() => {
        localStorage.clear();
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);
        TestBed.configureTestingModule({
        providers: [
            provideHttpClient(),
            provideHttpClientTesting(),
            { provide: Router, useValue: routerSpy }
        ]
        });
        service = TestBed.inject(AuthService);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        http.verify(); // falla si quedó alguna petición sin atender
        localStorage.clear();
    });

    it('login debería enviar las credenciales por POST y dejar la sesión activa', () => {
        service.login('ana@test.com', '1234').subscribe();

        const req = http.expectOne(`${API}/login`);
        expect(req.request.method).toBe('POST');
        expect(req.request.body).toEqual({ correoElectronico: 'ana@test.com', password: '1234' });

        req.flush({
        message: 'ok',
        token: 'jwt-123',
        usuario: { idUsuario: 3, nombre: 'Ana', correoElectronico: 'ana@test.com' }
        });

        let logueado = false;
        service.isLoggedIn$.subscribe(v => (logueado = v));
        expect(logueado).toBeTrue();
        expect(service.getToken()).toBe('jwt-123');
    });

    it('flujo admin: tras el login, getAllUsers consulta GET /usuarios y devuelve la lista', () => {
        service.login('admin@test.com', 'admin123').subscribe();
        http.expectOne(`${API}/login`).flush({
        message: 'ok',
        token: 'jwt-admin',
        usuario: { idUsuario: 7, nombre: 'Admin', correoElectronico: 'admin@test.com', rol: 'admin' }
        });

        let usuarios: unknown[] = [];
        service.getAllUsers().subscribe(u => (usuarios = u));

        const req = http.expectOne(API);
        expect(req.request.method).toBe('GET');

        req.flush([{ idUsuario: 1, nombre: 'Ana' }, { idUsuario: 2, nombre: 'Luis' }]);
        expect(usuarios.length).toBe(2);
    });

    it('logout debería revocar el JWT en el backend, limpiar la sesión y redirigir', () => {
        service.login('ana@test.com', '1234').subscribe();
        http.expectOne(`${API}/login`).flush({
        message: 'ok',
        token: 'jwt-123',
        usuario: { idUsuario: 3, nombre: 'Ana', correoElectronico: 'ana@test.com' }
        });

        service.logout();

        const req = http.expectOne(`${API}/logout`);
        expect(req.request.method).toBe('POST');
        expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-123');
        req.flush({ message: 'sesión cerrada' });

        expect(service.getToken()).toBeNull();
        expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    });

    it('deleteUser debería llamar a DELETE con el id correcto', () => {
        service.deleteUser(4).subscribe();

        const req = http.expectOne(`${API}/4`);
        expect(req.request.method).toBe('DELETE');
        req.flush({ message: 'eliminado' });
    });
});