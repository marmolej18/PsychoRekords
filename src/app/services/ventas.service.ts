// src/app/core/ventas/ventas.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';

// Interfaz para el Punto de Entrega
export interface PuntoEntrega {
  idpunto: number;
  nombrepunto: string;
  direccioncompleta: string;
  horarioatencion: string;
}

// Interfaz para el Detalle de la Venta que espera el Backend
export interface DetalleVentaDTO {
  idprod: number;
  cantidad: number;
  precioUnitario: number;
}

// Interfaz para el Body de la Transacción
export interface VentaDTO {
  idusuario: number;
  idpunto: number;
  productos: DetalleVentaDTO[];
}

// Interface para el producto dentro de una venta
export interface DetalleVenta {
  iddetalle: number;
  artista: string;
  titulo: string;
  cantidad: number;
  precioUnitario: number;
}

// Interface para una venta individual
export interface Venta {
  idventa: number;
  fecha: string; // String de fecha ISO
  totalventa: number;
  estadopedido: string;
  nombrepunto: string; // Nombre del punto de entrega
  detalles: DetalleVenta[]; // Lista de productos en la orden
}

@Injectable({
  providedIn: 'root'
})
export class VentasService {
  private apiUrl = `http://localhost:3000/api/ventas`;
  private puntosUrl = `http://localhost:3000/api/puntos-entrega`;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }


  private getAdminHeaders(): HttpHeaders {
        const userId = this.authService.getAuthHeader();
        return new HttpHeaders({
            'Content-Type': 'application/json',
            'x-user-id': userId || '' // ¡Asegura que el valor se obtiene!
        });
  }

  /**
   * GET /api/puntos-entrega
   * Obtiene la lista de puntos de recogida.
   */
  getPuntosEntrega(): Observable<PuntoEntrega[]> {
    return this.http.get<PuntoEntrega[]>(this.puntosUrl);
  }

  /**
   * POST /api/ventas
   * Ejecuta la transacción de compra en el backend.
   */
  crearVenta(ventaData: VentaDTO): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
    });
    // La lógica de Admin no aplica aquí, solo el contenido del body
    return this.http.post<any>(this.apiUrl, ventaData, { headers });
  }

  /**
   * GET /api/ventas/historial/:idUsuario
   * Obtiene el historial de ventas del usuario logueado.
   */
  getHistorialVentas(idUsuario: number): Observable<Venta[]> {
    const historialUrl = `${this.apiUrl}/usuario/${idUsuario}`;
    // Asumimos que el AuthInterceptor añade el token
    return this.http.get<Venta[]>(historialUrl);
  }

  getTodasLasVentas(): Observable<Venta[]> {
        const headers = this.getAdminHeaders();
        return this.http.get<Venta[]>(`${this.apiUrl}/todas`, { headers });
  }

    /**
     * PUT /api/ventas/cancelar/:idVenta - Llama al procedimiento almacenado de Node.js.
     */
  cancelarVenta(idventa: number): Observable<any> {
        console.log(idventa);
        const headers = this.getAdminHeaders();
        const url = `${this.apiUrl}/cancelar/${idventa}`;
        return this.http.put(url, {}, { headers });
  }
}