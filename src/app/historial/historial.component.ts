// src/app/features/ventas/historial/historial.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { VentasService, Venta } from '../services/ventas.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-historial',
  templateUrl: './historial.component.html',
  standalone: true,
  imports: [CommonModule, RouterModule],
  styleUrls: ['./historial.component.css']
})
export class HistorialComponent implements OnInit {

  historialVentas: Venta[] = [];
  loading: boolean = true;
  errorMessage: string | null = null;
  idUsuario: number | null = null;
  successMessage: string | null = null; // Nuevo para mensajes de éxito
  isAdmin$: Observable<boolean>; // Para mostrar el botón solo al admin

  constructor(
    private authService: AuthService,
    private ventasService: VentasService,
    private router: Router
  ) { 
    this.isAdmin$ = this.authService.isAdmin$;
  }

  ngOnInit(): void {
    const id = this.authService.getAuthHeader();
    if (!id) {
      this.router.navigate(['/login']);
      return;
    }
    this.idUsuario = Number(id);
    this.isAdmin$.subscribe(isAdmin => {
        if (isAdmin) {
            this.cargarTodasLasVentas(); // Cargar todas las ventas si es admin
        } else {
            this.cargarHistorialCliente(); // Cargar solo las del cliente
        }
    }).unsubscribe(); // Usamos unsubscribe para evitar múltiples llamadas
  }

  cargarHistorialCliente(): void {
    if (!this.idUsuario) return;

    this.loading = true;
    this.errorMessage = null;

    this.ventasService.getHistorialVentas(this.idUsuario).subscribe({
      next: (data) => {
        // Ordenar por fecha de venta, más reciente primero
        this.historialVentas = data.sort((a, b) =>
          new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
        );
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = 'Ocurrió un error al obtener tu historial de pedidos.';
        console.error('Error al cargar historial de ventas:', err);
      }
    });
  }

  cargarTodasLasVentas(): void {
    this.loading = true;
    this.errorMessage = null;

    this.ventasService.getTodasLasVentas().subscribe({
        next: (data) => {
            this.historialVentas = data.sort((a, b) => 
                new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
            );
            this.loading = false;
        },
        error: (err) => {
            this.loading = false;
            this.errorMessage = 'Ocurrió un error al obtener la gestión de órdenes. Asegúrate de tener rol "admin".';
            console.error('Error al cargar todas las ventas:', err);
        }
    });
}

  /**
   * Formatea la fecha y hora.
   */
  formatDate(dateString: string): string {
    console.log(dateString);
    return new Date(dateString).toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Devuelve la clase de color para el estado de la venta.
   */
  getEstadoClass(estado: string): string {
    if (!estado) {
        // Esto maneja tanto null como undefined
        return 'badge rounded-pill bg-secondary'; 
    }
    switch (estado.toUpperCase()) {
      case 'COMPLETADO':
        return 'badge bg-success';
      case 'PENDIENTE':
        return 'badge bg-warning text-dark';
      case 'CANCELADO':
        return 'badge bg-danger';
      default:
        return 'badge bg-secondary';
    }
  }

  cancelarVenta(idventa: number): void {
    if (!confirm(`¿Estás seguro de que quieres CANCELAR la orden #${idventa}? Se revertirá el inventario.`)) {
      return;
    }

    this.errorMessage = null;
    this.successMessage = null;
    
    // NOTA: Usamos .subscribe para manejar la llamada al PUT/cancelar
    this.ventasService.cancelarVenta(idventa).subscribe({
      next: (response) => {
        this.successMessage = `¡Orden #${idventa} cancelada con éxito! El inventario ha sido revertido.`;
        this.cargarTodasLasVentas(); // Recargar la lista para ver el estado actualizado
        setTimeout(() => this.successMessage = null, 5000);
      },
      error: (err) => {
        // Manejamos el error específico que devuelve el procedimiento
        this.errorMessage = err.error?.message || 'Error desconocido al cancelar la orden.';
        console.error('Error al cancelar:', err);
      }
    });
  }
}