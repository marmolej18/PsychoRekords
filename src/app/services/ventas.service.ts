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

// Dirección de envío que se congela dentro de la venta (HU7.1)
export interface DireccionEnvio {
  destinatario: string;
  telefono: string;
  calle: string;
  numero: string;
  colonia: string;
  cp: string;
  ciudad: string;
  estado: string;
  referencias?: string;
}

// Interfaz para el Body de la Transacción
export interface VentaDTO {
  idusuario: number;
  idpunto?: number;
  productos: DetalleVentaDTO[];
  envio: DireccionEnvio;
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
  nombrepunto: string; // Nombre del punto de entrega (solo pedidos anteriores al envío a domicilio)
  detalles: DetalleVenta[]; // Lista de productos en la orden
  // Dirección de envío congelada al momento de la compra
  envio_destinatario?: string | null;
  envio_telefono?: string | null;
  envio_calle?: string | null;
  envio_numero?: string | null;
  envio_colonia?: string | null;
  envio_cp?: string | null;
  envio_ciudad?: string | null;
  envio_estado?: string | null;
  envio_referencias?: string | null;
  // Rastreo, se llena cuando el pedido pasa a "En tránsito"
  paqueteria?: string | null;
  numero_guia?: string | null;
}

// Etapas por las que pasa un pedido enviado por paquetería, en orden (debe coincidir con el backend).
export const ETAPAS_PEDIDO = ['Pagado', 'En preparación', 'En tránsito', 'Entregado'];

// Paqueterías disponibles (deben coincidir con el backend) y su página de rastreo.
// Solo DHL acepta la guía en la URL; en las demás el cliente pega la guía en la página.
export const PAQUETERIAS: { nombre: string; rastreo: (guia: string) => string }[] = [
  { nombre: 'DHL', rastreo: guia => `https://www.dhl.com/mx-es/home/rastreo.html?tracking-id=${encodeURIComponent(guia)}&submit=1` },
  { nombre: 'Estafeta', rastreo: () => 'https://www.estafeta.com/Herramientas/Rastreo' },
  { nombre: 'Correos de México', rastreo: () => 'https://www.correosdemexico.gob.mx/SSLServicios/SeguimientoEnvio/Seguimiento.aspx' }
];

/** URL de rastreo del pedido, o null si todavía no tiene guía. */
export function urlRastreo(venta: Venta): string | null {
  const paqueteria = PAQUETERIAS.find(p => p.nombre === venta.paqueteria);
  return paqueteria && venta.numero_guia ? paqueteria.rastreo(venta.numero_guia) : null;
}

/** Compara estados sin importar mayúsculas, acentos ni espacios ("CANCELADO" == "Cancelado"). */
export const normalizarEstado = (estado: string | null | undefined): string =>
  (estado ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

export type FiltroPedidos = 'todos' | 'pagados' | 'preparacion' | 'transito' | 'entregados' | 'cancelados';

export const FILTROS_PEDIDO: { clave: FiltroPedidos; texto: string }[] = [
  { clave: 'todos', texto: 'Todos' },
  { clave: 'pagados', texto: 'Pagados' },
  { clave: 'preparacion', texto: 'En preparación' },
  { clave: 'transito', texto: 'En tránsito' },
  { clave: 'entregados', texto: 'Entregados' },
  { clave: 'cancelados', texto: 'Cancelados' }
];

const ESTADO_POR_FILTRO: Record<Exclude<FiltroPedidos, 'todos'>, string> = {
  pagados: 'PAGADO',
  preparacion: 'EN PREPARACION',
  transito: 'EN TRANSITO',
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
   * Para "En tránsito" se envían también la paquetería y el número de guía.
   */
  actualizarEstado(idventa: number, estado: string, rastreo?: { paqueteria: string; numeroGuia: string }):
      Observable<Pick<Venta, 'idventa' | 'estadopedido' | 'paqueteria' | 'numero_guia'>> {
    return this.http.put<Pick<Venta, 'idventa' | 'estadopedido' | 'paqueteria' | 'numero_guia'>>(
      `${this.apiUrl}/estado/${idventa}`, { estado, ...rastreo }, { headers: this.getAdminHeaders() });
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
