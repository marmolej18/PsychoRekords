// src/app/features/productos/carrito/carrito.component.ts
import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import Swal from 'sweetalert2';
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
  flag = false;
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

    const user: string | null = localStorage.getItem('currentUser');
    if (user) {
      this.flag = true;
    } else {
      this.flag = false;
    }
  }

  // suma o resta unidades y elimina el producto si baja a 0
  cambiarCantidad(item: CarritoItem, delta: number): void {
    const nueva = item.cantidad + delta;
    if (nueva <= 0) {
      this.carritoService.actualizarCantidad(item.producto.idprod, 0);
      Swal.fire({
        icon: 'info',
        title: 'Producto eliminado',
        text: `"${item.producto.titulo}" se quitó del carrito.`,
        toast: true,
        position: 'top-end',
        timer: 1800,
        showConfirmButton: false
      });
      return;
    }

    if (nueva > item.producto.cantstock) {
      Swal.fire({
        icon: 'warning',
        title: 'Límite de stock',
        text: `Solo hay ${item.producto.cantstock} unidades disponibles.`,
        timer: 2000,
        showConfirmButton: false
      });
      return;
    }

    this.carritoService.actualizarCantidad(item.producto.idprod, nueva);
  }

  eliminarItem(idProd: number): void {
    Swal.fire({
      icon: 'warning',
      title: '¿Eliminar producto?',
      text: '¿Estás seguro de que deseas eliminar este producto del carrito?',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.carritoService.eliminarProducto(idProd);
        Swal.fire({
          icon: 'success',
          title: 'Eliminado',
          text: 'El producto fue eliminado del carrito.',
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
  }

  vaciarCarrito(): void {
    Swal.fire({
      icon: 'warning',
      title: '¿Vaciar carrito?',
      text: 'Se eliminarán todos los productos de tu carrito.',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, vaciar',
      cancelButtonText: 'Cancelar'
    }).then(result => {
      if (result.isConfirmed) {
        this.carritoService.vaciarCarrito();
        Swal.fire({
          icon: 'success',
          title: 'Carrito vacío',
          timer: 1500,
          showConfirmButton: false
        });
      }
    });
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
