import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Venta, VentasService } from '../services/ventas.service';

@Component({
  selector: 'app-ventas-admin',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ventas-admin.component.html',
  styleUrl: './ventas-admin.component.css'
})
export class VentasAdminComponent implements OnInit {
  ventas: Venta[] = [];
  seleccionada: Venta | null = null;
  cargando = false;
  cargandoDetalle = false;
  error = '';
  errorDetalle = '';
  private solicitud = 0;

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

  verDetalle(idventa: number): void {
    const solicitud = ++this.solicitud;
    this.seleccionada = null;
    this.errorDetalle = '';
    this.cargandoDetalle = true;
    this.ventasService.getDetalleVenta(idventa).subscribe({
      next: venta => {
        if (solicitud !== this.solicitud) return;
        this.seleccionada = venta;
        this.cargandoDetalle = false;
      },
      error: err => {
        if (solicitud !== this.solicitud) return;
        this.errorDetalle = err.status === 404 ? 'La venta ya no está disponible.' : 'No se pudo cargar el detalle. Vuelve a seleccionarlo.';
        this.cargandoDetalle = false;
      }
    });
  }

  cerrarDetalle(): void {
    ++this.solicitud;
    this.seleccionada = null;
    this.cargandoDetalle = false;
    this.errorDetalle = '';
  }

  estadoClase(estado: string): string {
    switch (estado?.toUpperCase()) {
      case 'PAGADO': case 'ENTREGADO': case 'COMPLETADO': return 'badge bg-success';
      case 'CANCELADO': return 'badge bg-danger';
      case 'PENDIENTE': return 'badge bg-warning text-dark';
      default: return 'badge bg-secondary';
    }
  }
}
