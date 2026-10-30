// src/app/core/auth/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, finalize, tap } from 'rxjs';

// Interface para el objeto de usuario (coincide con la respuesta de tu API)
export interface UserAuth {
  idUsuario: number;
  nombre: string;
  correoElectronico: string;
  rol: 'cliente' | 'admin'; // Añadimos el rol aquí
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
  private loggedInSubject = new BehaviorSubject<boolean>(false);
  isLoggedIn$ = this.loggedInSubject.asObservable();

  private userSubject = new BehaviorSubject<UserAuth | null>(null);
  currentUser$ = this.userSubject.asObservable();

  private isAdminSubject = new BehaviorSubject<boolean>(false);
  isAdmin$ = this.isAdminSubject.asObservable();

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    // Cargar el estado al iniciar el servicio (ej: al refrescar la página)
    this.loadUserFromStorage();
  }

  /** Carga la sesión desde el almacenamiento local si existe junto con su JWT. */
  private loadUserFromStorage(): void {
    const userJson = localStorage.getItem('currentUser');
    const token = localStorage.getItem('auth_token');
    if (userJson && token) {
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
    this.loggedInSubject.next(!!user);
    this.isAdminSubject.next(user?.rol === 'admin');
  }

  /**
   * Envía las credenciales al backend para autenticación y almacena el JWT.
   */
  login(correoElectronico: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { correoElectronico, password }).pipe(
      tap(response => {
        const user: UserAuth = {
          ...response.usuario,
          rol: response.usuario.rol || 'cliente'
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
