// src/app/features/ventas/checkout/checkout.component.ts
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CarritoService } from '../services/carrito.service';
import { AuthService } from '../services/auth.service';
import { VentasService, PuntoEntrega, DetalleVentaDTO, VentaDTO } from '../services/ventas.service';
import { combineLatest, Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit {

  checkoutForm!: FormGroup;
  puntosEntrega$: Observable<PuntoEntrega[]> = new Observable();

  // Data del resumen (combinada)
  resumenVenta$: Observable<any> = new Observable();

  loading: boolean = false;
  purchaseComplete: boolean = false;
  ventaExitosaData: any = null;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private carritoService: CarritoService,
    private authService: AuthService,
    private ventasService: VentasService
  ) { }

  ngOnInit(): void {
    // 1. Verificar si el usuario está logueado y si el carrito no está vacío
    if (!this.authService.getAuthHeader() || this.carritoService.getItemCount() === 0) {
      this.router.navigate(['/carrito']);
      return;
    }

    // 2. Inicializar formulario (solo necesitamos la selección del punto)
    this.checkoutForm = this.fb.group({
      idpunto: ['', Validators.required],
      // Aquí se podría añadir un checkbox de "Aceptar términos y condiciones"
    });

    // 3. Cargar Puntos de Entrega
    this.puntosEntrega$ = this.ventasService.getPuntosEntrega();

    // 4. Combinar datos del carrito para el resumen (reutilizando lógica del CarritoComponent)
    this.resumenVenta$ = combineLatest([this.carritoService.items$, this.carritoService.getSubtotal()])
      .pipe(
        map(([items, subtotal]) => {
          const IVA_PORCENTAJE = 0.16;
          const COSTO_ENVIO = 80.00;
          const iva = subtotal * IVA_PORCENTAJE;
          const total = subtotal + iva + COSTO_ENVIO;

          return {
            items,
            subtotal,
            iva,
            costoEnvio: COSTO_ENVIO,
            total
          };
        })
      );
  }

  /**
   * Procesa la compra final (Llama a la API transaccional de Node.js).
   */
  async confirmarCompra(): Promise<void> {
    this.errorMessage = null;

    if (this.checkoutForm.invalid) {
      this.checkoutForm.markAllAsTouched();
      this.errorMessage = 'Por favor, selecciona un Punto de Entrega.';
      return;
    }

    const currentItems = this.carritoService.getItems();
    const idUsuario = Number(this.authService.getAuthHeader()); // idUsuario como número
    const idPunto = this.checkoutForm.get('idpunto')?.value;

    if (!currentItems || currentItems.length === 0) {
      this.errorMessage = 'El carrito está vacío. No se puede procesar la compra.';
      return;
    }

    this.loading = true;

    // 1. Mapear los ítems del carrito al formato DetalleVentaDTO que espera la API
    const productos: DetalleVentaDTO[] = currentItems.map(item => ({
      idprod: item.producto.idprod,
      cantidad: item.cantidad,
      // Usamos el precio final que estaba en el objeto Producto (ya convertido a número)
      precioUnitario: Number(item.producto.precio)
    }));

    const ventaData: VentaDTO = {
      idusuario: idUsuario,
      idpunto: idPunto,
      productos: productos,
    };

    // 2. Llamada al servicio para crear la venta (transacción)
    this.ventasService.crearVenta(ventaData).subscribe({
      next: (response) => {
        this.loading = false;
        this.ventaExitosaData = response;
        this.purchaseComplete = true;
        this.carritoService.vaciarCarrito(); // Limpiar el carrito después de la compra
      },
      error: (err) => {
        this.loading = false;
        // La API de Node.js devolverá mensajes específicos (ej: stock insuficiente)
        this.errorMessage = err.error?.message || 'Error en la transacción. Verifica el stock y reintenta.';
        console.error('Error al confirmar la compra:', err);
      }
    });
  }

  // Getters para fácil acceso al formulario
  get f() { return this.checkoutForm.controls; }
}