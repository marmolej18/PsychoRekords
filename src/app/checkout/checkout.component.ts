// src/app/features/ventas/checkout/checkout.component.ts
import { Component, OnInit, AfterViewInit, OnDestroy } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CarritoService } from '../services/carrito.service';
import { AuthService } from '../services/auth.service';
import { VentasService, DetalleVentaDTO, DireccionEnvio, VentaDTO } from '../services/ventas.service';
import { combineLatest, Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';

declare let paypal: any;

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit, AfterViewInit, OnDestroy {

  checkoutForm!: FormGroup;

  // Data del resumen (combinada)
  resumenVenta$ = new Observable<any>();

  loading = false;
  purchaseComplete = false;
  ventaExitosaData: any = null;
  errorMessage: string | null = null;

  // --- Estado de PayPal ---
  pagoPaypalRealizado = false;
  detallesPaypal: any = null;
  private paypalButtonRenderizado = false;
  private resumenSub?: Subscription;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private carritoService: CarritoService,
    private authService: AuthService,
    private ventasService: VentasService
  ) { }

  ngOnInit(): void {
    // 1. Inicializar formulario con la dirección de envío (HU7.1).
    // Va antes de la validación: si se redirige, el template se alcanza a renderizar y necesita el FormGroup.
    this.checkoutForm = this.fb.group({
      destinatario: ['', [Validators.required, Validators.maxLength(150)]],
      telefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      calle: ['', [Validators.required, Validators.maxLength(100)]],
      numero: ['', [Validators.required, Validators.maxLength(20)]],
      colonia: ['', [Validators.required, Validators.maxLength(100)]],
      cp: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
      ciudad: ['', [Validators.required, Validators.maxLength(50)]],
      estado: ['', [Validators.required, Validators.maxLength(50)]],
      referencias: ['', Validators.maxLength(300)],
    });

    // 2. Verificar si el usuario está logueado y si el carrito no está vacío
    if (!this.authService.getAuthHeader() || this.carritoService.getItemCount() === 0) {
      this.router.navigate(['/carrito']);
      return;
    }

    // 3. Prellenar con la dirección del perfil; el cliente puede cambiarla solo para este pedido.
    this.authService.getUserById(Number(this.authService.getAuthHeader())).subscribe({
      next: (perfil: any) => {
        const valor = (v: unknown) => (typeof v === 'string' ? v : '');
        this.checkoutForm.patchValue({
          destinatario: [perfil.nombre, perfil.apellidop, perfil.apellidom].filter(Boolean).join(' '),
          telefono: valor(perfil.telefono).replace(/\D/g, ''),
          calle: valor(perfil.calle),
          numero: valor(perfil.numcasa),
          colonia: valor(perfil.colonia),
          cp: valor(perfil.cp),
          ciudad: valor(perfil.ciudad),
          estado: valor(perfil.estado),
        });
      },
      error: () => { /* Sin perfil: el cliente captura la dirección a mano. */ }
    });

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

  ngAfterViewInit(): void {
    // Esperamos a tener el total real del resumen para renderizar el botón de PayPal
    this.resumenSub = this.resumenVenta$.subscribe(resumen => {
      if (resumen && !this.paypalButtonRenderizado && resumen.total > 0) {
        this.renderPaypalButton(resumen.total);
      }
    });
  }

  ngOnDestroy(): void {
    this.resumenSub?.unsubscribe();
  }

  private renderPaypalButton(total: number): void {
    // Guard: si el SDK de PayPal no está cargado (ej. en pruebas unitarias), no truena.
    if (typeof paypal === 'undefined') {
      return;
    }

    this.paypalButtonRenderizado = true;

    paypal.Buttons({
      createOrder: (data: any, actions: any) => {
        return actions.order.create({
          purchase_units: [{ amount: { value: total.toFixed(2) } }]
        });
      },
      onApprove: async (data: any, actions: any) => {
        const details = await actions.order.capture();
        this.detallesPaypal = details;
        this.pagoPaypalRealizado = true;
      },
      onError: (err: any) => {
        this.errorMessage = 'Hubo un problema al procesar el pago con PayPal. Intenta de nuevo.';
        console.error('Error de PayPal:', err);
      }
    }).render('#paypal-button-container');
  }

  

  /**
   * Procesa la compra final (Llama a la API transaccional de Node.js).
   */
  async confirmarCompra(): Promise<void> {
    this.errorMessage = null;

    if (this.checkoutForm.invalid) {
      this.checkoutForm.markAllAsTouched();
      this.errorMessage = 'Por favor, completa correctamente la dirección de envío.';
      return;
    }

    if (!this.pagoPaypalRealizado) {
      this.errorMessage = 'Debes completar el pago con PayPal antes de confirmar la compra.';
      return;
    }

    const currentItems = this.carritoService.getItems();
    const idUsuario = Number(this.authService.getAuthHeader()); // idUsuario como número
    const envio: DireccionEnvio = this.checkoutForm.value;

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
      productos: productos,
      envio,
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

