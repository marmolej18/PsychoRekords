// src/app/core/ventas/ventas.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

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
  cliente?: string;
  correo?: string;
  direccioncompleta?: string;
  horarioatencion?: string;
  idventa: number;
  fecha: string; // String de fecha ISO
  totalventa: number;
  estadopedido: string;
  nombrepunto: string; // Nombre del punto de entrega
  detalles: DetalleVenta[]; // Lista de productos en la orden
}

// Etapas por las que pasa un pedido de recogida en tienda, en orden (debe coincidir con el backend).
export const ETAPAS_PEDIDO = ['Pagado', 'Listo para recoger', 'Entregado'];

/** Compara estados sin importar mayúsculas, acentos ni espacios ("CANCELADO" == "Cancelado"). */
export const normalizarEstado = (estado: string | null | undefined): string =>
  (estado ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

export type FiltroPedidos = 'todos' | 'pagados' | 'listos' | 'entregados' | 'cancelados';

export const FILTROS_PEDIDO: { clave: FiltroPedidos; texto: string }[] = [
  { clave: 'todos', texto: 'Todos' },
  { clave: 'pagados', texto: 'Pagados' },
  { clave: 'listos', texto: 'Listos para recoger' },
  { clave: 'entregados', texto: 'Entregados' },
  { clave: 'cancelados', texto: 'Cancelados' }
];

const ESTADO_POR_FILTRO: Record<Exclude<FiltroPedidos, 'todos'>, string> = {
  pagados: 'PAGADO',
  listos: 'LISTO PARA RECOGER',
  entregados: 'ENTREGADO',
  cancelados: 'CANCELADO'
};

export function coincideFiltro(venta: Venta, filtro: FiltroPedidos): boolean {
  return filtro === 'todos' || normalizarEstado(venta.estadopedido) === ESTADO_POR_FILTRO[filtro];
}

@Injectable({
  providedIn: 'root'
})
export class VentasService {
  private apiUrl = `http://localhost:3000/api/ventas`;
  private puntosUrl = `http://localhost:3000/api/puntos-entrega`;

  constructor(private http: HttpClient) { }

  private getAdminHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json'
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
    return this.http.post<any>(this.apiUrl, ventaData, { headers });
  }

  /**
   * GET /api/ventas/mis-pedidos
   * Pedidos del cliente autenticado (el backend toma el usuario del JWT).
   */
  getMisPedidos(): Observable<Venta[]> {
    return this.http.get<Venta[]>(`${this.apiUrl}/mis-pedidos`);
  }

  getDetalleVenta(idventa: number): Observable<Venta> {
    return this.http.get<Venta>(`${this.apiUrl}/detalle/${idventa}`, { headers: this.getAdminHeaders() });
  }

  getTodasLasVentas(): Observable<Venta[]> {
    const headers = this.getAdminHeaders();
    return this.http.get<Venta[]>(`${this.apiUrl}/todas`, { headers });
  }

  /**
   * PUT /api/ventas/estado/:idventa - Avanza el pedido a la siguiente etapa (Admin).
   */
  actualizarEstado(idventa: number, estado: string): Observable<{ idventa: number; estadopedido: string }> {
    return this.http.put<{ idventa: number; estadopedido: string }>(
      `${this.apiUrl}/estado/${idventa}`, { estado }, { headers: this.getAdminHeaders() });
  }

  /**
   * PUT /api/ventas/cancelar/:idVenta - Llama al procedimiento almacenado de Node.js.
   */
  cancelarVenta(idventa: number): Observable<any> {
    const headers = this.getAdminHeaders();
    const url = `${this.apiUrl}/cancelar/${idventa}`;
    return this.http.put(url, {}, { headers });
  }
}
