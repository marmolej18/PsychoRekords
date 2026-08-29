import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ReportesService {
  private baseUrl = 'http://localhost:3000/api/reportes';

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) { }


  getTrazabilidadStock(idProd: number): Observable<any[]> {
    const headers = this.getAdminHeaders();
    return this.http.get<any[]>(`${this.baseUrl}/stock-trazabilidad/${idProd}`, { headers });
  }

  /**
   * Configura las cabeceras necesarias para las peticiones de administrador.
   * Obtiene el ID del usuario logueado.
   */
  private getAdminHeaders(): HttpHeaders {
    const userId = this.authService.getAuthHeader();
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'x-user-id': userId || ''
    });
  }

  /**
   * GET /api/reportes/rentables - Reporte de Productos Rentables
   */
  getReporteRentables(): Observable<any[]> {
    const headers = this.getAdminHeaders();
    return this.http.get<any[]>(`${this.baseUrl}/rentables`, { headers });
  }

  /**
   * GET /api/reportes/ventas-formato - Reporte de Ventas por Formato (ROLLUP)
   */
  getReporteVentasFormato(): Observable<any[]> {
    const headers = this.getAdminHeaders();
    return this.http.get<any[]>(`${this.baseUrl}/ventas-formato`, { headers });
  }
}


