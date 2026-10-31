// src/app/features/productos/carrito/carrito.component.ts
import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { CarritoService } from '../services/carrito.service';
import { Producto } from '../services/productos.service';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface CarritoItem {
  producto: Producto;
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

  carritoItems$ = new Observable<CarritoItem[]>();
  subtotal$ = new Observable<number>();

  IVA_PORCENTAJE = 0.16; // 16% de IVA
  COSTO_ENVIO = 80.00;   // Costo fijo de envío

  constructor(
    private carritoService: CarritoService
  ) { }

  ngOnInit(): void {
    this.carritoItems$ = this.carritoService.items$;
    this.subtotal$ = this.carritoService.getSubtotal();
  }

  // suma o resta unidades dentro del limite de stock
  cambiarCantidad(item: CarritoItem, delta: number): void {
    const nueva = item.cantidad + delta;
    if (nueva >= 1 && nueva <= item.producto.cantstock) {
      this.carritoService.actualizarCantidad(item.producto.idprod, nueva);
    }
  }

  eliminarItem(idProd: number): void {
    if (confirm('¿Estás seguro de que deseas eliminar este producto del carrito?')) {
      this.carritoService.eliminarProducto(idProd);
    }
  }

  vaciarCarrito(): void {
    if (confirm('¿Estás seguro de que deseas vaciar todo el carrito?')) {
      this.carritoService.vaciarCarrito();
    }
  }

  calcularIVA(subtotal: number): number {
    return subtotal * this.IVA_PORCENTAJE;
  }

  calcularTotal(subtotal: number, iva: number): number {
    return subtotal + iva + this.COSTO_ENVIO;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = 'logo.png';
    img.onerror = null;
  }
}
