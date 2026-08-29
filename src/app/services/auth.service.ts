// src/app/core/auth/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs'; // Asume que tienes un archivo de entorno

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

  constructor(private http: HttpClient) {
    // Cargar el estado al iniciar el servicio (ej: al refrescar la página)
    this.loadUserFromStorage();
  }

  /** Carga la sesión desde el almacenamiento local si existe. */
  private loadUserFromStorage(): void {
    const userJson = localStorage.getItem('currentUser');
    if (userJson) {
      const user: UserAuth = JSON.parse(userJson);
      this.setUserState(user);
    }
  }

  /** Actualiza todos los sujetos de estado. */
  private setUserState(user: UserAuth | null): void {
    this.userSubject.next(user);
    this.loggedInSubject.next(!!user);
    this.isAdminSubject.next(user?.rol === 'admin' ? true : false);
  }

  /**
   * Envía las credenciales al backend para autenticación.
   */
  login(correoElectronico: string, password: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/login`, { correoElectronico, password }).pipe(
      tap(response => {
        // La respuesta de tu API contiene: { message, usuario: { idUsuario, nombre, correoElectronico } }

        // IMPORTANTE: Tienes que asegurarte de que tu API devuelva el ROL también en la respuesta del login.
        // Si no lo hace, necesitarías hacer una petición adicional a /api/usuarios/:id o modificar el backend.
        // ASUMO que la API devuelve { idUsuario, nombre, correoElectronico, rol }

        const user: UserAuth = {
          ...response.usuario,
          rol: response.usuario.rol || 'cliente' // Por defecto, es 'cliente'
        };

        // Guardar la sesión en localStorage y actualizar el estado
        localStorage.setItem('currentUser', JSON.stringify(user));
        this.setUserState(user);
      })
    );
  }

  /**
   * Cierra la sesión, limpia el almacenamiento y el estado.
   */
  logout(): void {
    localStorage.removeItem('currentUser');
    this.setUserState(null);
    // Redireccionar al inicio o login
    // this.router.navigate(['/login']); 
  }

  /**
   * Obtiene el token de autorización (simulado con el ID del usuario)
   * Útil para añadir la cabecera 'x-user-id' a peticiones de Admin/Perfil/Historial.
   */
  getAuthHeader(): string | null {
    const user = this.userSubject.getValue();
    return user ? String(user.idUsuario) : null;
  }

  /**
   * Obtiene la lista completa de usuarios (Solo Admin).
   * GET /api/usuarios
   */
  getAllUsers(): Observable<UserAdmin[]> {
    const headers = this.getAdminHeaders();
    // El Interceptor añadirá el 'x-user-id' del administrador logueado
    return this.http.get<UserAdmin[]>(`${this.apiUrl}`, { headers });
  }

  /**
   * Obtiene un usuario por ID (Solo Admin).
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
    // El Interceptor añadirá el 'x-user-id' del administrador
    const headers = this.getAdminHeaders();
    return this.http.put<any>(`${this.apiUrl}/${id}`, userData, { headers });
  }

  /**
   * Elimina/Desactiva un usuario.
   * DELETE /api/usuarios/:id
   */
  deleteUser(id: number): Observable<any> {
    // Nota: Dependiendo de tu lógica de negocio, esto podría ser una eliminación suave (soft delete).
    const headers = this.getAdminHeaders();
    return this.http.delete<any>(`${this.apiUrl}/${id}`, { headers });
  }

  /**
 * Configura las cabeceras necesarias para las peticiones de administrador.
 * La API de Node.js espera 'x-user-id'.
 */
  private getAdminHeaders(): HttpHeaders {
    const userId = this.getAuthHeader();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      // Simulación de autenticación de administrador con el ID del usuario logueado
      'x-user-id': userId || ''
    });
  }
}