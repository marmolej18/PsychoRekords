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

  private readonly STORAGE_KEY = 'tienda_carrito';

  constructor() {
    this.loadInitialData();
  }

  /**
   * Carga el carrito desde localStorage al iniciar la aplicación.
   */
  loadInitialData(): void {
    const itemsJson = localStorage.getItem(this.STORAGE_KEY);
    if (itemsJson) {
      const items = JSON.parse(itemsJson);
      this.itemsSubject.next(items);
      this.updateItemCount(items);
    }
  }

  /**
   * Guarda el estado actual del carrito en localStorage.
   */
  private saveCart(items: CarritoItem[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
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
  agregarProducto(producto: Producto, cantidad: number = 1): void {
    const items = this.itemsSubject.getValue();
    const existingItem = items.find(item => item.producto.idprod === producto.idprod);

    if (existingItem) {
      existingItem.cantidad += cantidad;
    } else {
      items.push({ producto, cantidad });
    }

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