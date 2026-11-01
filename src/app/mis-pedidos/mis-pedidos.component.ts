import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Venta, VentasService } from '../services/ventas.service';

export type FiltroPedidos = 'todos' | 'curso' | 'entregados' | 'cancelados';

// Etapas por las que pasa un pedido de recogida en tienda, en orden.
export const ETAPAS = ['Pagado', 'Listo para recoger', 'Entregado'];

const normalizar = (estado: string | null | undefined): string =>
  (estado ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

@Component({
  selector: 'app-mis-pedidos',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './mis-pedidos.component.html',
  styleUrl: './mis-pedidos.component.css'
})
export class MisPedidosComponent implements OnInit {
  readonly etapas = ETAPAS;
  readonly filtros: { clave: FiltroPedidos; texto: string }[] = [
    { clave: 'todos', texto: 'Todos' },
    { clave: 'curso', texto: 'En curso' },
    { clave: 'entregados', texto: 'Entregados' },
    { clave: 'cancelados', texto: 'Cancelados' }
  ];

  pedidos: Venta[] = [];
  filtro: FiltroPedidos = 'todos';
  abierto: number | null = null;
  cargando = false;
  error = '';

  constructor(
    private authService: AuthService,
    private ventasService: VentasService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.getAuthHeader()) {
      this.router.navigate(['/login']);
      return;
    }
    this.cargarPedidos();
  }

  cargarPedidos(): void {
    this.cargando = true;
    this.error = '';
    this.ventasService.getMisPedidos().subscribe({
      next: pedidos => { this.pedidos = pedidos; this.cargando = false; },
      error: () => { this.error = 'No pudimos cargar tus pedidos. Intenta nuevamente.'; this.cargando = false; }
    });
  }

  get pedidosFiltrados(): Venta[] {
    return this.pedidos.filter(p => this.coincide(p, this.filtro));
  }

  contar(filtro: FiltroPedidos): number {
    return this.pedidos.filter(p => this.coincide(p, filtro)).length;
  }

  private coincide(pedido: Venta, filtro: FiltroPedidos): boolean {
    switch (filtro) {
      case 'curso': return !this.esCancelado(pedido) && !this.esEntregado(pedido);
      case 'entregados': return this.esEntregado(pedido);
      case 'cancelados': return this.esCancelado(pedido);
      default: return true;
    }
  }

  alternar(idventa: number): void {
    this.abierto = this.abierto === idventa ? null : idventa;
  }

  esCancelado(pedido: Venta): boolean { return normalizar(pedido.estadopedido) === 'CANCELADO'; }
  esEntregado(pedido: Venta): boolean { return normalizar(pedido.estadopedido) === 'ENTREGADO'; }

  /** Índice de la etapa actual del pedido (-1 si el estado no forma parte del flujo). */
  etapaActual(pedido: Venta): number {
    return ETAPAS.findIndex(e => normalizar(e) === normalizar(pedido.estadopedido));
  }

  estadoTexto(pedido: Venta): string {
    if (this.esCancelado(pedido)) return 'Cancelado';
    const i = this.etapaActual(pedido);
    return i >= 0 ? ETAPAS[i] : (pedido.estadopedido || 'Sin estado');
  }

  estadoClase(pedido: Venta): string {
    if (this.esCancelado(pedido)) return 'badge bg-danger';
    if (this.esEntregado(pedido)) return 'badge bg-success';
    return this.etapaActual(pedido) >= 0 ? 'badge bg-info text-dark' : 'badge bg-secondary';
  }

  totalArticulos(pedido: Venta): number {
    return pedido.detalles.reduce((suma, d) => suma + d.cantidad, 0);
  }
}
