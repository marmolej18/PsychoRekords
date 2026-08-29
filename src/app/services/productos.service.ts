// src/app/core/productos/productos.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service'; // Necesario para obtener el ID de Admin

// Interfaz que mapea la estructura de la tabla Producto
export interface Producto {
  idprod: number;
  titulo: string;
  artista: string;
  generomus: string | null;
  aniolanzam: number | null;
  formato: 'Vinilo' | 'CD' | 'Cassette';
  condiciones: string | null;
  cantstock: number;
  precio: number;
  // Nota: PostgreSQL devuelve NUMERIC como string, por lo que es mejor convertirlo a number en el componente
}

// Interfaz para la respuesta de creación/actualización (por si es necesario tipar mejor)
interface ProductoResponse {
  message: string;
  producto: Producto;
}

@Injectable({
  providedIn: 'root'
})
export class ProductosService {
  private apiUrl = `http://localhost:3000/api/productos`;

  constructor(
    private http: HttpClient,
    private authService: AuthService // Inyectamos el AuthService para las peticiones de Admin
  ) { }

  // --- MÉTODOS PÚBLICOS (Catálogo) ---

  /**
   * GET /api/productos
   * Obtiene la lista completa de productos.
   */
  getProductos(): Observable<Producto[]> {
    return this.http.get<Producto[]>(this.apiUrl);
  }

  /**
   * GET /api/productos/:id
   * Obtiene los detalles de un solo producto.
   */
  getProducto(id: number): Observable<Producto> {
    return this.http.get<Producto>(`${this.apiUrl}/${id}`);
  }

  // --- MÉTODOS DE ADMINISTRACIÓN (Inventario) ---

  /**
   * Configura las cabeceras necesarias para las peticiones de administrador.
   * La API de Node.js espera 'x-user-id'.
   */
  private getAdminHeaders(): HttpHeaders {
    const userId = this.authService.getAuthHeader();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      // Simulación de autenticación de administrador con el ID del usuario logueado
      'x-user-id': userId || ''
    });
  }

  /**
   * POST /api/productos
   * Crea un nuevo producto (requiere rol de Admin).
   */
  crearProducto(producto: Omit<Producto, 'idProd'>): Observable<ProductoResponse> {
    const headers = this.getAdminHeaders();
    return this.http.post<ProductoResponse>(this.apiUrl, producto, { headers });
  }

  /**
   * PUT /api/productos/:id
   * Actualiza un producto existente (requiere rol de Admin).
   */
  actualizarProducto(id: number, cambios: Partial<Producto>): Observable<ProductoResponse> {
    const headers = this.getAdminHeaders();
    return this.http.put<ProductoResponse>(`${this.apiUrl}/${id}`, cambios, { headers });
  }
}