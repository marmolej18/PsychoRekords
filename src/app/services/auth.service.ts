// src/app/core/auth/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, distinctUntilChanged, finalize, map, tap } from 'rxjs';

// Interface para el objeto de usuario (coincide con la respuesta de tu API)
export interface UserAuth {
    idUsuario: number;
    nombre: string;
    correoElectronico: string;
    rol: 'cliente' | 'admin'; // Añadimos el rol aquí
}

export interface JwtPayload {
    idUsuario?: number;
    correoElectronico?: string;
    rol?: 'cliente' | 'admin';
    exp?: number;
    iat?: number;
}

export interface UserAdmin {
    idUsuario: number;
    nombre: string;
    apellidoP: string;
    apellidoM: string | null;
    correoElectronico: string;
    telefono: string | null;
    CP: string | null;
    calle: string | null;
    colonia: string | null;
    numCasa: string | null;
    ciudad: string | null;
    estado: string | null;
    rol: 'cliente' | 'admin';
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private apiUrl = `http://localhost:3000/api/usuarios`;

    // Sujetos reactivos para el estado
    private userSubject = new BehaviorSubject<UserAuth | null>(null);
    currentUser$ = this.userSubject.asObservable();
    isLoggedIn$ = this.currentUser$.pipe(map(u => !!u), distinctUntilChanged());
    isAdmin$ = this.currentUser$.pipe(map(u => u?.rol === 'admin'), distinctUntilChanged());

    constructor(
        private http: HttpClient,
        private router: Router
    ) {
        // Cargar el estado al iniciar el servicio (ej: al refrescar la página)
        this.loadUserFromStorage();
    }

    // decodifica el payload en Base64url sin verificar firma en el navegador
    decodeTokenPayload(token: string): JwtPayload | null {
        const parts = token.split('.');
        if (parts.length !== 3) {
            return null;
        }

        try {
            const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
            const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, '=');
            const jsonPayload = decodeURIComponent(
                atob(padded)
                    .split('')
                    .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                    .join('')
            );
            return JSON.parse(jsonPayload) as JwtPayload;
        } catch {
            return null;
        }
    }

    // revisa si el claim exp del token ya vencio
    isTokenExpired(token: string): boolean {
        const payload = this.decodeTokenPayload(token);
        if (!payload || typeof payload.exp !== 'number') {
            return false;
        }
        return payload.exp * 1000 <= Date.now();
    }

    /** Carga la sesión desde el almacenamiento local si existe junto con su JWT vigente. */
    private loadUserFromStorage(): void {
        const userJson = localStorage.getItem('currentUser');
        const token = localStorage.getItem('auth_token');
        if (userJson && token) {
            if (this.isTokenExpired(token)) {
                this.clearSession();
                return;
            }
            try {
                const user: UserAuth = JSON.parse(userJson);
                this.setUserState(user);
            } catch {
                this.clearSession();
            }
        } else if (userJson && !token) {
            this.clearSession();
        }
    }

    /** Actualiza todos los sujetos de estado. */
    private setUserState(user: UserAuth | null): void {
        this.userSubject.next(user);
    }

    /**
     * Envía las credenciales al backend para autenticación y almacena el JWT.
     */
    login(correoElectronico: string, password: string): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/login`, { correoElectronico, password }).pipe(
            tap(response => {
                const payload = response.token ? this.decodeTokenPayload(response.token) : null;
                const user: UserAuth = {
                    ...response.usuario,
                    rol: response.usuario.rol || payload?.rol || 'cliente'
                };

                if (response.token) {
                    localStorage.setItem('auth_token', response.token);
                }
                localStorage.setItem('currentUser', JSON.stringify(user));
                this.setUserState(user);
            })
        );
    }

    /**
     * Limpia únicamente los datos de sesión ('auth_token' y 'currentUser'),
     * manteniendo intacto el carrito de compras en localStorage.
     */
    clearSession(): void {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('currentUser');
        this.setUserState(null);
    }

    /**
     * Cierra la sesión de forma segura: revoca el JWT en el backend (token_blocklist),
     * limpia la sesión local sin vaciar el carrito y redirige a /login.
     */
    logout(): void {
        const token = localStorage.getItem('auth_token');

        if (token) {
            const headers = new HttpHeaders({
                Authorization: `Bearer ${token}`
            });

            this.http.post(`${this.apiUrl}/logout`, {}, { headers }).pipe(
                finalize(() => {
                    this.clearSession();
                    this.router.navigate(['/login']);
                })
            ).subscribe({
                error: (err) => console.error('Error al cerrar sesión en el servidor:', err)
            });
        } else {
            this.clearSession();
            this.router.navigate(['/login']);
        }
    }

    /**
     * Obtiene el ID del usuario autenticado actualmente.
     */
    getAuthHeader(): string | null {
        const user = this.userSubject.getValue();
        return user ? String(user.idUsuario) : null;
    }

    /**
     * Obtiene el token JWT almacenado.
     */
    getToken(): string | null {
        return localStorage.getItem('auth_token');
    }

    /**
     * Obtiene la lista completa de usuarios (Solo Admin).
     * GET /api/usuarios
     */
    getAllUsers(): Observable<UserAdmin[]> {
        const headers = this.getAdminHeaders();
        return this.http.get<UserAdmin[]>(`${this.apiUrl}`, { headers });
    }

    /**
     * Obtiene un usuario por ID (Admin/Propio).
     * GET /api/usuarios/:id
     */
    getUserById(id: number): Observable<UserAdmin> {
        const headers = this.getAdminHeaders();
        return this.http.get<UserAdmin>(`${this.apiUrl}/${id}`, { headers });
    }

    /**
     * Actualiza los datos de un usuario (incluye rol).
     * PUT /api/usuarios/:id
     */
    updateUser(id: number, userData: Partial<UserAdmin>): Observable<any> {
        const headers = this.getAdminHeaders();
        return this.http.put<any>(`${this.apiUrl}/${id}`, userData, { headers });
    }

    /**
     * Elimina/Desactiva un usuario.
     * DELETE /api/usuarios/:id
     */
    deleteUser(id: number): Observable<any> {
        const headers = this.getAdminHeaders();
        return this.http.delete<any>(`${this.apiUrl}/${id}`, { headers });
    }

    /**
     * Configura las cabeceras estándar JSON (el token Bearer lo inyecta authInterceptor).
     */
    private getAdminHeaders(): HttpHeaders {
        return new HttpHeaders({
            'Content-Type': 'application/json'
        });
    }
}
