import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription, interval } from 'rxjs';
import { Producto, ProductosService } from '../services/productos.service';
import { CarritoService } from '../services/carrito.service';

@Component({
  selector: 'app-catalogo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './catalogo.component.html',
  styleUrls: ['./catalogo.component.css']
})
export class CatalogoComponent implements OnInit, OnDestroy {

  productos: Producto[] = [];
  productosFiltrados: Producto[] = [];
  loading = true;
  errorMessage: string | null = null;
  itemMessageMap = new Map<number, string>();

  // filtros del catalogo
  searchTerm = '';
  formatoFiltro = '';
  generoFiltro = '';
  condicionFiltro = '';
  precioMax: number | null = null;
  soloDisponibles = false;
  ordenFiltro = '';

  // listas dinamicas para los selectores
  generosDisponibles: string[] = [];
  condicionesDisponibles: string[] = [];

  private stockSub?: Subscription;
  private carritoSub?: Subscription;
  private cantidadesEnCarrito = new Map<number, number>();

  constructor(
    private productosService: ProductosService,
    private carritoService: CarritoService
  ) { }

  ngOnInit(): void {
    // escuchar cambios del carrito para descontar el stock en tiempo real
    this.carritoSub = this.carritoService.items$.subscribe(items => {
      this.cantidadesEnCarrito.clear();
      items.forEach(item => {
        this.cantidadesEnCarrito.set(item.producto.idprod, item.cantidad);
      });
      this.aplicarFiltros();
    });

    this.cargarProductos(true);

    // consultar stock actualizado cada 5 segundos
    this.stockSub = interval(5000).subscribe(() => {
      this.cargarProductos(false);
    });
  }

  ngOnDestroy(): void {
    this.stockSub?.unsubscribe();
    this.carritoSub?.unsubscribe();
  }

  // obtiene los productos y actualiza las opciones de filtrado
  cargarProductos(mostrarCarga = true): void {
    if (mostrarCarga) {
      this.loading = true;
      this.errorMessage = null;
    }

    this.productosService.getProductos().subscribe({
      next: (data: Producto[]) => {
        this.productos = data.map(p => ({
          ...p,
          precio: Number(p.precio),
          cantstock: Number(p.cantstock)
        }));

        this.generosDisponibles = [...new Set(
          this.productos.map(p => p.generomus).filter((g): g is string => !!g)
        )].sort();

        this.condicionesDisponibles = [...new Set(
          this.productos.map(p => p.condiciones).filter((c): c is string => !!c)
        )].sort();

        this.aplicarFiltros();
        this.loading = false;
      },
      error: (err: unknown) => {
        if (mostrarCarga) {
          this.loading = false;
          this.errorMessage = 'Error al cargar el catálogo. Por favor, verifica la conexión con el servidor.';
        }
        console.error('Error al cargar productos:', err);
      }
    });
  }

  // calcula el stock real restando lo que ya está en el carrito
  getStockDisponible(producto: Producto): number {
    const enCarrito = this.cantidadesEnCarrito.get(producto.idprod) || 0;
    return Math.max(0, producto.cantstock - enCarrito);
  }

  onSearchChange(termino: string): void {
    this.searchTerm = termino;
    this.aplicarFiltros();
  }

  // aplica todos los filtros activos y el ordenamiento
  aplicarFiltros(): void {
    const termino = this.searchTerm.trim().toLowerCase();

    const resultado = this.productos.filter(producto => {
      const coincideTexto = !termino ||
        producto.titulo?.toLowerCase().includes(termino) ||
        producto.artista?.toLowerCase().includes(termino) ||
        producto.generomus?.toLowerCase().includes(termino) ||
        producto.formato?.toLowerCase().includes(termino);

      const coincideFormato = !this.formatoFiltro || producto.formato === this.formatoFiltro;
      const coincideGenero = !this.generoFiltro || producto.generomus === this.generoFiltro;
      const coincideCondicion = !this.condicionFiltro || producto.condiciones === this.condicionFiltro;
      const coincidePrecio = this.precioMax === null || this.precioMax <= 0 || producto.precio <= this.precioMax;
      const coincideStock = !this.soloDisponibles || this.getStockDisponible(producto) > 0;

      return coincideTexto && coincideFormato && coincideGenero && coincideCondicion && coincidePrecio && coincideStock;
    });

    if (this.ordenFiltro === 'precio_asc') {
      resultado.sort((a, b) => a.precio - b.precio);
    } else if (this.ordenFiltro === 'precio_desc') {
      resultado.sort((a, b) => b.precio - a.precio);
    } else if (this.ordenFiltro === 'anio_desc') {
      resultado.sort((a, b) => (b.aniolanzam || 0) - (a.aniolanzam || 0));
    }

    this.productosFiltrados = resultado;
  }

  limpiarBusqueda(): void {
    this.searchTerm = '';
    this.formatoFiltro = '';
    this.generoFiltro = '';
    this.condicionFiltro = '';
    this.precioMax = null;
    this.soloDisponibles = false;
    this.ordenFiltro = '';
    this.aplicarFiltros();
  }

  // agrega una unidad validando el stock disponible en tiempo real
  agregarAlCarrito(producto: Producto): void {
    if (this.getStockDisponible(producto) <= 0) {
      this.showMessage(producto.idprod, 'Stock agotado.', 'danger');
      return;
    }

    this.carritoService.agregarProducto(producto, 1);
    this.showMessage(producto.idprod, '¡Añadido al carrito!', 'success');
  }

  showMessage(idProd: number, message: string, type: 'success' | 'danger'): void {
    this.itemMessageMap.set(idProd, `${type}:${message}`);
    setTimeout(() => {
      this.itemMessageMap.delete(idProd);
    }, 2000);
  }

  getAlertClass(idProd: number): string {
    const message = this.itemMessageMap.get(idProd);
    if (message) {
      const type = message.split(':')[0];
      return type === 'success' ? 'alert-success' : 'alert-danger';
    }
    return '';
  }

  getItemMessage(idProd: number): string | undefined {
    const message = this.itemMessageMap.get(idProd);
    return message ? message.split(':')[1] : undefined;
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.src = '/logo_rana.png';
    img.onerror = null;
  }
}
