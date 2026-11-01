import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  coincideFiltro, ETAPAS_PEDIDO, FILTROS_PEDIDO, FiltroPedidos, Venta, VentasService
} from '../services/ventas.service';

@Component({
  selector: 'app-ventas-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ventas-admin.component.html',
  styleUrl: './ventas-admin.component.css'
})
export class VentasAdminComponent implements OnInit {
  readonly filtros = FILTROS_PEDIDO;
  filtro: FiltroPedidos = 'todos';
  ventas: Venta[] = [];
  seleccionada: Venta | null = null;
  cargando = false;
  cargandoDetalle = false;
  error = '';
  errorDetalle = '';
  actualizando = false;
  mensajeEstado = '';
  private solicitud = 0;
  @ViewChild('detalle') detalle?: ElementRef<HTMLElement>;

  constructor(private ventasService: VentasService) {}

  ngOnInit(): void { this.cargarVentas(); }

  cargarVentas(): void {
    this.cargando = true;
    this.error = '';
    this.ventasService.getTodasLasVentas().subscribe({
      next: ventas => { this.ventas = ventas; this.cargando = false; },
      error: () => { this.error = 'No se pudieron cargar las ventas. Intenta nuevamente.'; this.cargando = false; }
    });
  }

  get ventasFiltradas(): Venta[] {
    return this.ventas.filter(v => coincideFiltro(v, this.filtro));
  }

  contar(filtro: FiltroPedidos): number {
    return this.ventas.filter(v => coincideFiltro(v, filtro)).length;
  }

  verDetalle(idventa: number): void {
    const solicitud = ++this.solicitud;
    this.seleccionada = null;
    this.errorDetalle = '';
    this.mensajeEstado = '';
    this.cargandoDetalle = true;
    this.ventasService.getDetalleVenta(idventa).subscribe({
      next: venta => {
        if (solicitud !== this.solicitud) return;
        this.seleccionada = venta;
        this.cargandoDetalle = false;
        this.irAlDetalle();
      },
      error: err => {
        if (solicitud !== this.solicitud) return;
        this.errorDetalle = err.status === 404 ? 'La venta ya no está disponible.' : 'No se pudo cargar el detalle. Vuelve a seleccionarlo.';
        this.cargandoDetalle = false;
        this.irAlDetalle();
      }
    });
  }

  /** Desplaza la página al detalle una vez que Angular lo haya pintado. */
  private irAlDetalle(): void {
    setTimeout(() => this.detalle?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  cerrarDetalle(): void {
    ++this.solicitud;
    this.seleccionada = null;
    this.cargandoDetalle = false;
    this.errorDetalle = '';
    this.mensajeEstado = '';
  }

  /** Etapa a la que puede avanzar el pedido, o null si ya no tiene más (entregado, cancelado, etc.). */
  siguienteEtapa(venta: Venta): string | null {
    const i = ETAPAS_PEDIDO.findIndex(e => e.toUpperCase() === venta.estadopedido?.toUpperCase());
    return i >= 0 && i < ETAPAS_PEDIDO.length - 1 ? ETAPAS_PEDIDO[i + 1] : null;
  }

  avanzarEstado(venta: Venta): void {
    const estado = this.siguienteEtapa(venta);
    if (!estado || !confirm(`¿Marcar el pedido #${venta.idventa} como "${estado}"?`)) return;
    this.actualizando = true;
    this.errorDetalle = '';
    this.mensajeEstado = '';
    this.ventasService.actualizarEstado(venta.idventa, estado).subscribe({
      next: r => {
        venta.estadopedido = r.estadopedido;
        const fila = this.ventas.find(v => v.idventa === venta.idventa);
        if (fila) fila.estadopedido = r.estadopedido;
        this.mensajeEstado = `Pedido #${venta.idventa} marcado como "${r.estadopedido}".`;
        this.actualizando = false;
      },
      error: err => {
        this.errorDetalle = err.error?.message || 'No se pudo actualizar el estado del pedido.';
        this.actualizando = false;
      }
    });
  }

  /** Se puede cancelar mientras el pedido no se haya entregado ni cancelado. */
  puedeCancelar(venta: Venta): boolean {
    const estado = venta.estadopedido?.toUpperCase();
    return estado !== 'CANCELADO' && estado !== 'ENTREGADO';
  }

  cancelarPedido(venta: Venta): void {
    if (!this.puedeCancelar(venta) ||
        !confirm(`¿Cancelar el pedido #${venta.idventa}? Los productos regresarán al inventario y no se puede deshacer.`)) return;
    this.actualizando = true;
    this.errorDetalle = '';
    this.mensajeEstado = '';
    this.ventasService.cancelarVenta(venta.idventa).subscribe({
      next: () => {
        for (const v of [venta, this.ventas.find(f => f.idventa === venta.idventa)]) {
          if (v) { v.estadopedido = 'CANCELADO'; v.totalventa = 0; }
        }
        this.mensajeEstado = `Pedido #${venta.idventa} cancelado. El inventario fue revertido.`;
        this.actualizando = false;
      },
      error: err => {
        this.errorDetalle = err.error?.message || 'No se pudo cancelar el pedido.';
        this.actualizando = false;
      }
    });
  }

  estadoClase(estado: string): string {
    switch (estado?.toUpperCase()) {
      case 'LISTO PARA RECOGER': return 'badge bg-info text-dark';
      case 'PAGADO': case 'ENTREGADO': case 'COMPLETADO': return 'badge bg-success';
      case 'CANCELADO': return 'badge bg-danger';
      case 'PENDIENTE': return 'badge bg-warning text-dark';
      default: return 'badge bg-secondary';
    }
  }
}
