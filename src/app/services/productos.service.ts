// src/app/core/productos/productos.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

// Lista fija de condiciones de producto (usada en el formulario de inventario y en el filtro del catálogo)
export const CONDICIONES_PRODUCTO: readonly string[] = ['Nuevo', 'Usado - Excelente', 'Usado - Bueno', 'Usado - Regular'];

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
  imagen_url?: string | null; // Portada subida desde Inventario (ruta en el backend), o null
}

const URL_BACKEND = 'http://localhost:3000';

/**
 * Portada del disco: la que subió el admin; si no hay, la imagen por título de la carpeta public
 * (como funcionaba antes). Si esa tampoco existe, cada vista muestra el logo con su onImageError.
 */
export function urlPortada(producto: Pick<Producto, 'titulo' | 'imagen_url'>): string {
  return producto.imagen_url ? URL_BACKEND + producto.imagen_url : `/${producto.titulo}.jpg`;
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
  private apiUrl = `${URL_BACKEND}/api/productos`;

  constructor(private http: HttpClient) { }

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
   * Configura las cabeceras estándar JSON (el token Bearer lo añade authInterceptor).
   */
  private getAdminHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json'
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

  /**
   * PUT /api/productos/:id/imagen
   * Sube o reemplaza la portada del disco (requiere rol de Admin). Sin Content-Type a mano:
   * el navegador lo pone con el separador que necesita el envío de archivos (multipart).
   */
  subirImagen(id: number, archivo: File): Observable<ProductoResponse> {
    const formulario = new FormData();
    formulario.append('imagen', archivo);
    return this.http.put<ProductoResponse>(`${this.apiUrl}/${id}/imagen`, formulario);
  }
}
