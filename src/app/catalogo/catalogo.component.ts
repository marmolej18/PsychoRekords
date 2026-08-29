// src/app/features/productos/catalogo/catalogo.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Producto, ProductosService } from '../services/productos.service';
import { CarritoService } from '../services/carrito.service';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './catalogo.component.html',
  styleUrls: ['./catalogo.component.css']
})
export class CatalogoComponent implements OnInit {

  productos: Producto[] = [];
  loading: boolean = true;
  errorMessage: string | null = null;
  itemMessageMap: Map<number, string> = new Map();

  constructor(
    private productosService: ProductosService,
    private carritoService: CarritoService
  ) { }

  ngOnInit(): void {
    this.cargarProductos();
  }

  /**
   * Obtiene la lista de productos de la API.
   */
  cargarProductos(): void {
    this.loading = true;
    this.errorMessage = null;

    this.productosService.getProductos().subscribe({
      next: (data: any) => {
        this.productos = data.map((p: any) => ({
          ...p,
          precio: Number(p.precio)
        }));
        this.loading = false;
      },
      error: (err: any) => {
        this.loading = false;
        this.errorMessage = 'Error al cargar el catálogo. Por favor, verifica la conexión con el servidor.';
        console.error('Error al cargar productos:', err);
      }
    });
  }

  /**
   * Añade el producto seleccionado al carrito de compras.
   */
  agregarAlCarrito(producto: Producto): void {
    if (producto.cantstock <= 0) {
      this.showMessage(producto.idprod, 'Stock agotado.', 'danger');
      return;
    }

    // Asumimos que siempre se añade 1 unidad por click
    this.carritoService.agregarProducto(producto, 1);
    this.showMessage(producto.idprod, '¡Añadido al carrito!', 'success');
  }

  /**
   * Muestra un mensaje temporal en el producto.
   */
  showMessage(idProd: number, message: string, type: 'success' | 'danger'): void {
    this.itemMessageMap.set(idProd, `${type}:${message}`);
    setTimeout(() => {
      this.itemMessageMap.delete(idProd);
    }, 2000);
  }

  /**
   * Retorna el color de la alerta para el producto (usado en el HTML).
   */
  getAlertClass(idProd: number): string {
    const message = this.itemMessageMap.get(idProd);
    if (message) {
      const type = message.split(':')[0];
      return type === 'success' ? 'alert-success' : 'alert-danger';
    }
    return '';
  }

  /**
   * Retorna el mensaje visible para el producto (usado en el HTML).
   */
  getItemMessage(idProd: number): string | undefined {
    const message = this.itemMessageMap.get(idProd);
    return message ? message.split(':')[1] : undefined;
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