import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';
import {
  coincideFiltro, ETAPAS_PEDIDO, FILTROS_PEDIDO, FiltroPedidos, normalizarEstado as normalizar, urlRastreo, Venta, VentasService
} from '../services/ventas.service';

@Component({
  selector: 'app-mis-pedidos',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './mis-pedidos.component.html',
  styleUrl: './mis-pedidos.component.css'
})
export class MisPedidosComponent implements OnInit {
  readonly etapas = ETAPAS_PEDIDO;
  // Las cancelaciones las hace el admin; el cliente las solicita por el WhatsApp del negocio (mismo enlace que el footer).
  readonly whatsappNegocio = 'https://wa.me/qr/DPZGF3WG5WBOJ1';
  readonly filtros = FILTROS_PEDIDO;
  readonly urlRastreo = urlRastreo;

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
    return this.pedidos.filter(p => coincideFiltro(p, this.filtro));
  }

  contar(filtro: FiltroPedidos): number {
    return this.pedidos.filter(p => coincideFiltro(p, filtro)).length;
  }

  alternar(idventa: number): void {
    this.abierto = this.abierto === idventa ? null : idventa;
  }

  esCancelado(pedido: Venta): boolean { return normalizar(pedido.estadopedido) === 'CANCELADO'; }
  esEntregado(pedido: Venta): boolean { return normalizar(pedido.estadopedido) === 'ENTREGADO'; }
  // Ya salió a paquetería: el negocio no puede cancelarlo ni regresar el stock.
  yaSalio(pedido: Venta): boolean { return ['EN TRANSITO', 'ENTREGADO'].includes(normalizar(pedido.estadopedido)); }

  /** Índice de la etapa actual del pedido (-1 si el estado no forma parte del flujo). */
  etapaActual(pedido: Venta): number {
    return ETAPAS_PEDIDO.findIndex(e => normalizar(e) === normalizar(pedido.estadopedido));
  }

  estadoTexto(pedido: Venta): string {
    if (this.esCancelado(pedido)) return 'Cancelado';
    const i = this.etapaActual(pedido);
    return i >= 0 ? ETAPAS_PEDIDO[i] : (pedido.estadopedido || 'Sin estado');
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
