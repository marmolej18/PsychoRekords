// src/app/features/productos/carrito/carrito.component.ts
import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { CarritoService } from '../services/carrito.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
// Interface para CarritoItem (repetida para claridad)
interface CarritoItem {
  producto: any;
  cantidad: number;
}

@Component({
  selector: 'app-carrito',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './carrito.component.html',
  styleUrls: ['./carrito.component.css']
})
export class CarritoComponent implements OnInit {

  carritoItems$: Observable<CarritoItem[]> = new Observable();
  subtotal$: Observable<number> = new Observable();

  IVA_PORCENTAJE = 0.16; // 16% de IVA
  COSTO_ENVIO = 80.00;   // Costo fijo de envío

  constructor(
    private carritoService: CarritoService
  ) { }

  ngOnInit(): void {
    this.carritoItems$ = this.carritoService.items$;
    this.subtotal$ = this.carritoService.getSubtotal();
  }

  /**
   * Elimina un producto del carrito.
   */
  eliminarItem(idProd: number): void {
    if (confirm('¿Estás seguro de que deseas eliminar este producto del carrito?')) {
      this.carritoService.eliminarProducto(idProd);
    }
  }

  /**
   * Vacía todo el carrito.
   */
  vaciarCarrito(): void {
    if (confirm('¿Estás seguro de que deseas vaciar todo el carrito?')) {
      this.carritoService.vaciarCarrito();
    }
  }

  /**
   * Calcula el IVA basado en el subtotal.
   */
  calcularIVA(subtotal: number): number {
    return subtotal * this.IVA_PORCENTAJE;
  }

  /**
   * Calcula el total final (Subtotal + IVA + Envío).
   */
  calcularTotal(subtotal: number, iva: number): number {
    return subtotal + iva + this.COSTO_ENVIO;
  }

  /**
 * Maneja el error de carga de la imagen del producto.
 * Si la imagen no existe, se reemplaza por el logo por defecto.
 */
  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'logo.png';
    // Prevenir bucle infinito si el logo también falla
    img.onerror = null;
  }
}