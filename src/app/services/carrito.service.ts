// src/app/core/carrito/carrito.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Producto } from './productos.service'; // Reutiliza la interfaz Producto

// Define la estructura de un item dentro del carrito
interface CarritoItem {
  producto: Producto;
  cantidad: number;
}

@Injectable({
  providedIn: 'root'
})
export class CarritoService {
  private itemsSubject = new BehaviorSubject<CarritoItem[]>([]);
  items$ = this.itemsSubject.asObservable();

  // Observable para el conteo de ítems (utilizado en el NavBar)
  private itemCountSubject = new BehaviorSubject<number>(0);
  itemCount$ = this.itemCountSubject.asObservable();

  /**
   * Obtiene el valor actual de los ítems del carrito de forma síncrona.
   */
  getItems(): CarritoItem[] {
    return this.itemsSubject.getValue();
  }

  /**
   * Obtiene el valor actual del conteo de ítems de forma síncrona.
   */
  getItemCount(): number {
    return this.itemCountSubject.getValue();
  }

  // Carrito de invitado (sin sesión); cada usuario tiene el suyo en 'tienda_carrito_<idUsuario>'.
  private readonly STORAGE_KEY = 'tienda_carrito';
  private idUsuario: number | null = null;

  private get storageKey(): string {
    return this.idUsuario ? `${this.STORAGE_KEY}_${this.idUsuario}` : this.STORAGE_KEY;
  }

  constructor() {
    this.loadInitialData();
  }

  /**
   * Carga el carrito del usuario actual (o el de invitado) desde localStorage.
   */
  loadInitialData(): void {
    const items = this.leerCarrito(this.storageKey);
    this.itemsSubject.next(items);
    this.updateItemCount(items);
  }

  /**
   * Cambia al carrito del usuario que inició sesión, o al de invitado si la cerró (null).
   * Lo que se agregó como invitado se suma al carrito del usuario al iniciar sesión, así
   * quien cierra sesión no le deja su carrito a la siguiente persona en ese navegador.
   */
  cambiarUsuario(idUsuario: number | null): void {
    if (idUsuario === this.idUsuario) return;
    this.idUsuario = idUsuario;
    const items = this.leerCarrito(this.storageKey);

    if (idUsuario) {
      const invitado = this.leerCarrito(this.STORAGE_KEY);
      for (const nuevo of invitado) {
        const existente = items.find(i => i.producto.idprod === nuevo.producto.idprod);
        if (existente) {
          existente.producto = nuevo.producto;
          existente.cantidad = Math.min(existente.cantidad + nuevo.cantidad, nuevo.producto.cantstock);
        } else {
          items.push(nuevo);
        }
      }
      if (invitado.length) localStorage.removeItem(this.STORAGE_KEY);
    }

    this.itemsSubject.next(items);
    this.saveCart(items);
  }

  private leerCarrito(clave: string): CarritoItem[] {
    try {
      const items = JSON.parse(localStorage.getItem(clave) ?? '[]');
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }

  /**
   * Guarda el estado actual del carrito en localStorage.
   */
  private saveCart(items: CarritoItem[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(items));
    this.updateItemCount(items);
  }

  /**
   * Actualiza el conteo total de items para el badge de la Navbar.
   */
  private updateItemCount(items: CarritoItem[]): void {
    const count = items.reduce((total, item) => total + item.cantidad, 0);
    this.itemCountSubject.next(count);
  }

  /**
   * Añade un producto al carrito o incrementa su cantidad.
   */
  agregarProducto(producto: Producto, cantidad = 1): void {
    const items = this.itemsSubject.getValue();
    const existingItem = items.find(item => item.producto.idprod === producto.idprod);

    if (existingItem) {
      existingItem.producto = producto;
      existingItem.cantidad = Math.min(existingItem.cantidad + cantidad, producto.cantstock);
    } else {
      items.push({ producto, cantidad: Math.min(cantidad, producto.cantstock) });
    }

    this.itemsSubject.next(items);
    this.saveCart(items);
  }

  // actualiza las unidades o elimina el producto si llega a 0
  actualizarCantidad(idProd: number, nuevaCantidad: number): void {
    if (nuevaCantidad <= 0) {
      this.eliminarProducto(idProd);
      return;
    }

    const items = this.itemsSubject.getValue();
    const item = items.find(i => i.producto.idprod === idProd);
    if (!item) return;

    const maxStock = Number(item.producto.cantstock) || 1;
    item.cantidad = Math.min(nuevaCantidad, maxStock);
    this.itemsSubject.next(items);
    this.saveCart(items);
  }

  /**
   * Elimina un producto completamente del carrito.
   */
  eliminarProducto(idProd: number): void {
    const items = this.itemsSubject.getValue().filter(item => item.producto.idprod !== idProd);
    this.itemsSubject.next(items);
    this.saveCart(items);
  }

  /**
   * Vacía todo el carrito.
   */
  vaciarCarrito(): void {
    const emptyCart: CarritoItem[] = [];
    this.itemsSubject.next(emptyCart);
    this.saveCart(emptyCart);
  }

  /**
   * Calcula el subtotal de la compra.
   */
  getSubtotal(): Observable<number> {
    return new Observable<number>(observer => {
      this.items$.subscribe(items => {
        const subtotal = items.reduce((sum, item) => sum + (item.producto.precio * item.cantidad), 0);
        observer.next(subtotal);
      });
    });
  }
}
