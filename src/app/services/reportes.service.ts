import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface MetricasTienda {
  periodo: string; // 'YYYY-MM' del mes actual
  ventasMes: { ingresos: number; pedidos: number };
  ventasMesAnterior: { ingresos: number; pedidos: number };
  usuarios: { total: number; clientes: number; admins: number };
  productoTopMes: { idprod: number; titulo: string; artista: string; unidades: number } | null;
}

@Injectable({
  providedIn: 'root'
})
export class ReportesService {
  private baseUrl = 'http://localhost:3000/api/reportes';

  constructor(private http: HttpClient) { }

  getTrazabilidadStock(idProd: number): Observable<any[]> {
    const headers = this.getAdminHeaders();
    return this.http.get<any[]>(`${this.baseUrl}/stock-trazabilidad/${idProd}`, { headers });
  }

  /**
   * Configura las cabeceras estándar JSON (el token Bearer lo añade authInterceptor).
   */
  private getAdminHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json'
    });
  }

  /**
   * GET /api/reportes/metricas - Métricas básicas (ventas del mes, usuarios, producto top del mes)
   */
  getMetricas(): Observable<MetricasTienda> {
    return this.http.get<MetricasTienda>(`${this.baseUrl}/metricas`);
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