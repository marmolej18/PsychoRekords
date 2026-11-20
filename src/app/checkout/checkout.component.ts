// src/app/features/ventas/checkout/checkout.component.ts
import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CarritoService } from '../services/carrito.service';
import { AuthService } from '../services/auth.service';
import {
  VentasService, ConfirmacionPago, ContactoPunto, DetalleVentaDTO, DireccionEnvio, PuntoEntrega, TarifaEnvio, VentaDTO
} from '../services/ventas.service';
import { combineLatest, firstValueFrom, Observable, Subscription } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { STRIPE_PUBLISHABLE_KEY } from '../config/stripe.config';

declare let paypal: any;
declare let Stripe: any;

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit, AfterViewInit, OnDestroy {

  checkoutForm!: FormGroup;

  // Opciones de entrega: envío a domicilio con tarifa fija, o punto medio gratuito en Aguascalientes
  tarifas: TarifaEnvio[] = [];
  puntos: PuntoEntrega[] = [];
  errorOpciones = '';

  // Data del resumen (combinada)
  resumenVenta$ = new Observable<any>();
  private totalActual = 0;

  loading = false;
  purchaseComplete = false;
  ventaExitosaData: any = null;
  errorMessage: string | null = null;

  // --- Estado de PayPal ---
  pagoPaypalRealizado = false;
  detallesPaypal: any = null;
  private paypalButtonRenderizado = false;
  private resumenSub?: Subscription;

  // --- Estado de Stripe (pago con tarjeta, HU4.2) ---
  // Los datos de la tarjeta los captura Stripe en su propio campo; nunca pasan por nuestro código.
  @ViewChild('tarjetaContainer') tarjetaContainer?: ElementRef<HTMLElement>;
  private stripe: any = null;
  private campoTarjeta: any = null;
  tarjetaCompleta = false;
  errorTarjeta = '';
  // Venta creada en el backend esperando el cobro; se reutiliza si el cliente reintenta con otra tarjeta.
  private ventaPendiente: { idVenta: number; clientSecret: string; totalVenta: number } | null = null;
  // Nombre y correo del perfil: OXXO los pide para generar la ficha (HU4.3).
  private nombreCliente = '';
  private correoCliente = '';

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private carritoService: CarritoService,
    private authService: AuthService,
    private ventasService: VentasService
  ) { }

  ngOnInit(): void {
    // 1. Inicializar formulario: forma de entrega ("tarifa-<id>" o "punto-<id>") y dirección de envío (HU7.1).
    // La dirección solo se pide para envío a domicilio; en punto medio queda deshabilitada (y no se valida).
    // Va antes de la validación: si se redirige, el template se alcanza a renderizar y necesita el FormGroup.
    this.checkoutForm = this.fb.group({
      entrega: ['', Validators.required],
      metodoPago: [this.stripeDisponible ? 'tarjeta' : 'paypal', Validators.required],
      direccion: this.fb.group({
        destinatario: ['', [Validators.required, Validators.maxLength(150)]],
        telefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
        calle: ['', [Validators.required, Validators.maxLength(100)]],
        numero: ['', [Validators.required, Validators.maxLength(20)]],
        colonia: ['', [Validators.required, Validators.maxLength(100)]],
        cp: ['', [Validators.required, Validators.pattern(/^\d{5}$/)]],
        ciudad: ['', [Validators.required, Validators.maxLength(50)]],
        estado: ['', [Validators.required, Validators.maxLength(50)]],
        referencias: ['', Validators.maxLength(300)],
      }),
      // En punto medio: cómo contactar al cliente y cómo reconocerlo al entregar.
      contacto: this.fb.group({
        correo: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
        telefono: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
        referencias: ['', [Validators.required, Validators.maxLength(300)]],
      }),
    });
    // Solo se valida el grupo de la opción elegida; el otro queda deshabilitado.
    const direccion = this.checkoutForm.get('direccion')!;
    const contacto = this.checkoutForm.get('contacto')!;
    direccion.disable();
    contacto.disable();
    this.checkoutForm.get('entrega')!.valueChanges.subscribe(() => {
        if (this.esDomicilio) {
        direccion.enable();
        } else {
        direccion.disable();
        }

        if (this.esPuntoMedio) {
        contacto.enable();
        } else {
        contacto.disable();
        }
    });

    // 2. Verificar si el usuario está logueado y si el carrito no está vacío
    if (!this.authService.getAuthHeader() || this.carritoService.getItemCount() === 0) {
      this.router.navigate(['/carrito']);
      return;
    }

    // 3. Cargar las opciones de entrega
    combineLatest([this.ventasService.getTarifasEnvio(), this.ventasService.getPuntosEntrega()]).subscribe({
      next: ([tarifas, puntos]) => { this.tarifas = tarifas; this.puntos = puntos; },
      error: () => { this.errorOpciones = 'No se pudieron cargar las opciones de entrega. Recarga la página.'; }
    });

    // 4. Prellenar con la dirección del perfil; el cliente puede cambiarla solo para este pedido.
    this.authService.getMiPerfil().subscribe({
      next: perfil => {
        const valor = (v: unknown) => (typeof v === 'string' ? v : '');
        const telefono = valor(perfil.telefono).replace(/\D/g, '');
        this.nombreCliente = [perfil.nombre, perfil.apellidoP, perfil.apellidoM].filter(Boolean).join(' ');
        this.correoCliente = valor(perfil.correoElectronico);
        contacto.patchValue({ correo: valor(perfil.correoElectronico), telefono });
        direccion.patchValue({
          destinatario: [perfil.nombre, perfil.apellidoP, perfil.apellidoM].filter(Boolean).join(' '),
          telefono,
          calle: valor(perfil.calle),
          numero: valor(perfil.numCasa),
          colonia: valor(perfil.colonia),
          cp: valor(perfil.CP),
          ciudad: valor(perfil.ciudad),
          estado: valor(perfil.estado),
        });
      },
      error: () => { /* Sin perfil: el cliente captura la dirección a mano. */ }
    });

    // 5. Combinar datos del carrito y la entrega elegida para el resumen
    const entrega$ = this.checkoutForm.get('entrega')!.valueChanges.pipe(startWith(''));
    this.resumenVenta$ = combineLatest([this.carritoService.items$, this.carritoService.getSubtotal(), entrega$])
      .pipe(
        map(([items, subtotal]) => {
          const IVA_PORCENTAJE = 0.16;
          const costoEnvio = this.costoEnvio;
          const iva = subtotal * IVA_PORCENTAJE;
          const total = subtotal + iva + costoEnvio;

          return {
            items,
            subtotal,
            iva,
            costoEnvio,
            entregaElegida: !!this.checkoutForm.get('entrega')!.value,
            total
          };
        })
      );
  }

  ngAfterViewInit(): void {
    // El botón de PayPal se pinta una vez; el monto se toma al momento de pagar (totalActual).
    this.resumenSub = this.resumenVenta$.subscribe(resumen => {
      this.totalActual = resumen.total;
      if (!this.paypalButtonRenderizado && resumen.total > 0) {
        this.renderPaypalButton();
      }
    });
    this.montarCampoTarjeta();
  }

  /** Stripe está listo si hay llave pública y se cargó Stripe.js (en pruebas unitarias no se carga). */
  get stripeDisponible(): boolean {
    return !!STRIPE_PUBLISHABLE_KEY && typeof Stripe !== 'undefined';
  }

  get metodoPago(): 'tarjeta' | 'paypal' | 'oxxo' {
    return this.checkoutForm?.getRawValue().metodoPago;
  }

  private montarCampoTarjeta(): void {
    if (!this.stripeDisponible || !this.tarjetaContainer || this.campoTarjeta) return;
    this.stripe = Stripe(STRIPE_PUBLISHABLE_KEY);
    this.campoTarjeta = this.stripe.elements({ locale: 'es' }).create('card', { hidePostalCode: true });
    this.campoTarjeta.mount(this.tarjetaContainer.nativeElement);
    this.campoTarjeta.on('change', (evento: any) => {
      this.tarjetaCompleta = evento.complete;
      this.errorTarjeta = evento.error?.message ?? '';
    });
  }

  /** Tarifa elegida, o undefined si el cliente eligió un punto medio (o nada todavía). */
  get tarifaElegida(): TarifaEnvio | undefined {
    const [tipo, id] = String(this.checkoutForm.get('entrega')?.value ?? '').split('-');
    return tipo === 'tarifa' ? this.tarifas.find(t => t.idtarifa === Number(id)) : undefined;
  }

  get esDomicilio(): boolean {
    return String(this.checkoutForm.get('entrega')?.value ?? '').startsWith('tarifa-');
  }

  get esPuntoMedio(): boolean {
    return String(this.checkoutForm.get('entrega')?.value ?? '').startsWith('punto-');
  }

  /** Los puntos medios son gratis; a domicilio se cobra la tarifa fija de la paquetería. */
  get costoEnvio(): number {
    return this.tarifaElegida?.precio ?? 0;
  }

  ngOnDestroy(): void {
    this.resumenSub?.unsubscribe();
    this.campoTarjeta?.destroy();
  }

  private renderPaypalButton(): void {
    // Guard: si el SDK de PayPal no está cargado (ej. en pruebas unitarias), no truena.
    if (typeof paypal === 'undefined') {
      return;
    }

    this.paypalButtonRenderizado = true;

    paypal.Buttons({
      // Se cobra el total vigente al pagar: incluye el envío que se haya elegido.
      onClick: (data: any, actions: any) => {
        if (!this.checkoutForm.get('entrega')!.value) {
          this.errorMessage = 'Elige cómo quieres recibir tu pedido antes de pagar.';
          return actions.reject();
        }
        return actions.resolve();
      },
      createOrder: (data: any, actions: any) => {
        return actions.order.create({
          purchase_units: [{ amount: { value: this.totalActual.toFixed(2) } }]
        });
      },
      onApprove: async (data: any, actions: any) => {
        const details = await actions.order.capture();
        this.detallesPaypal = details;
        this.pagoPaypalRealizado = true;
        // Ya se cobró ese envío con PayPal: no se permite cambiar la forma de entrega ni el método.
        this.checkoutForm.get('entrega')!.disable({ emitEvent: false });
        this.checkoutForm.get('metodoPago')!.disable({ emitEvent: false });
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
    const ventaData = this.armarVenta('paypal');
    if (!ventaData) return;

    if (!this.pagoPaypalRealizado) {
      this.errorMessage = 'Debes completar el pago con PayPal antes de confirmar la compra.';
      return;
    }

    this.loading = true;

    // Llamada al servicio para crear la venta (transacción)
    this.ventasService.crearVenta(ventaData).subscribe({
      next: (response) => this.terminarCompra(response),
      error: (err) => {
        this.loading = false;
        // La API de Node.js devolverá mensajes específicos (ej: stock insuficiente)
        this.errorMessage = err.error?.message || 'Error en la transacción. Verifica el stock y reintenta.';
        console.error('Error al confirmar la compra:', err);
      }
    });
  }

  /**
   * Pago con tarjeta (HU4.2): el backend crea la venta como 'Pendiente de pago' y el cobro en Stripe
   * por el total que él calcula; Stripe cobra la tarjeta aquí mismo y al final el backend le pregunta
   * a Stripe si el cobro fue real antes de marcar la venta como pagada.
   */
  async pagarConTarjeta(): Promise<void> {
    this.errorMessage = null;
    if (!this.stripe || !this.campoTarjeta) {
      this.errorMessage = 'El pago con tarjeta no está disponible en este momento.';
      return;
    }
    if (!this.tarjetaCompleta) {
      this.errorMessage = this.errorTarjeta || 'Completa los datos de la tarjeta.';
      return;
    }

    this.loading = true;
    try {
      if (!this.ventaPendiente) {
        const ventaData = this.armarVenta('tarjeta');
        if (!ventaData) { this.loading = false; return; }
        const venta = await firstValueFrom(this.ventasService.crearVenta(ventaData));
        this.ventaPendiente = { idVenta: venta.idVenta, clientSecret: venta.clientSecret, totalVenta: venta.totalVenta };
        // La venta ya existe con esta entrega y este método: no se pueden cambiar en un reintento.
        this.checkoutForm.get('entrega')!.disable({ emitEvent: false });
        this.checkoutForm.get('metodoPago')!.disable({ emitEvent: false });
      }

      const { error } = await this.stripe.confirmCardPayment(this.ventaPendiente.clientSecret, {
        payment_method: { card: this.campoTarjeta }
      });
      if (error) {
        // Tarjeta rechazada, fondos insuficientes, etc.: la venta sigue pendiente y puede reintentar.
        this.errorMessage = error.message || 'No se pudo cobrar la tarjeta.';
        this.loading = false;
        return;
      }

      await firstValueFrom(this.ventasService.confirmarPago(this.ventaPendiente.idVenta));
      this.terminarCompra(this.ventaPendiente);
    } catch (err: any) {
      this.loading = false;
      this.errorMessage = err?.error?.message || 'No se pudo completar el pago con tarjeta.';
      console.error('Error en el pago con tarjeta:', err);
    }
  }

  /**
   * Pago en efectivo en OXXO (HU4.3): el backend crea la venta 'Pendiente de pago' y el cobro OXXO;
   * Stripe genera la ficha con código de barras y la muestra. El pedido se confirma hasta que se paga
   * en tienda; el stock se descuenta en ese momento, no antes.
   */
  async generarFichaOxxo(): Promise<void> {
    this.errorMessage = null;
    if (!this.stripe) {
      this.errorMessage = 'El pago en OXXO no está disponible en este momento.';
      return;
    }
    const ventaData = this.armarVenta('oxxo');
    if (!ventaData) return;
    const { contacto, direccion } = this.checkoutForm.getRawValue();
    const nombre = this.nombreCliente || direccion?.destinatario;
    const correo = this.correoCliente || contacto?.correo;
    if (!nombre || !correo) {
      this.errorMessage = 'Para generar la ficha de OXXO necesitamos tu nombre y correo; complétalos en tu perfil.';
      return;
    }

    this.loading = true;
    try {
      const venta = await firstValueFrom(this.ventasService.crearVenta(ventaData));
      const { error } = await this.stripe.confirmOxxoPayment(venta.clientSecret, {
        payment_method: { billing_details: { name: nombre, email: correo } }
      });
      if (error) {
        this.loading = false;
        this.errorMessage = error.message || 'No se pudo generar la ficha de OXXO.';
        return;
      }
      const ficha = await firstValueFrom(this.ventasService.confirmarPago(venta.idVenta));
      this.terminarCompra({ ...ficha, totalVenta: venta.totalVenta });
    } catch (err: any) {
      this.loading = false;
      this.errorMessage = err?.error?.message || 'No se pudo generar la ficha de OXXO.';
      console.error('Error al generar la ficha de OXXO:', err);
    }
  }

  /** Valida el formulario y arma el pedido para el backend; devuelve null y muestra el error si falta algo. */
  private armarVenta(metodoPago: 'paypal' | 'tarjeta' | 'oxxo'): VentaDTO | null {
    // getRawValue: la entrega se deshabilita (bloquea) al pagar, pero su valor sigue contando.
    const { entrega, direccion, contacto } = this.checkoutForm.getRawValue();
    if (!entrega) {
      this.errorMessage = 'Elige cómo quieres recibir tu pedido.';
      return null;
    }
    if (this.checkoutForm.invalid) {
      this.checkoutForm.markAllAsTouched();
      this.errorMessage = this.esPuntoMedio
        ? 'Por favor, completa correo, teléfono y referencias para la entrega.'
        : 'Por favor, completa correctamente la dirección de envío.';
      return null;
    }

    const currentItems = this.carritoService.getItems();
    if (!currentItems || currentItems.length === 0) {
      this.errorMessage = 'El carrito está vacío. No se puede procesar la compra.';
      return null;
    }

    const idUsuario = Number(this.authService.getAuthHeader()); // idUsuario como número
    const [tipo, idEntrega] = String(entrega).split('-');

    // Mapear los ítems del carrito al formato DetalleVentaDTO que espera la API
    const productos: DetalleVentaDTO[] = currentItems.map(item => ({
      idprod: item.producto.idprod,
      cantidad: item.cantidad,
      // Usamos el precio final que estaba en el objeto Producto (ya convertido a número)
      precioUnitario: Number(item.producto.precio)
    }));

    // Punto medio: el punto y el contacto. A domicilio: la tarifa y la dirección.
    return tipo === 'punto'
      ? { idusuario: idUsuario, productos, idpunto: Number(idEntrega), envio: contacto as ContactoPunto, metodoPago }
      : { idusuario: idUsuario, productos, idtarifa: Number(idEntrega), envio: direccion as DireccionEnvio, metodoPago };
  }

  // Con OXXO la venta trae la ficha (fichaUrl, referencia, vence) y el pedido sigue pendiente de pago.
  private terminarCompra(venta: { idVenta: number; totalVenta: number } & Partial<ConfirmacionPago>): void {
    this.loading = false;
    this.ventaExitosaData = venta;
    this.purchaseComplete = true;
    this.carritoService.vaciarCarrito(); // Limpiar el carrito después de la compra
  }

  

  // Getters para fácil acceso al formulario
  get f() { return this.checkoutForm.controls; }
  get d() { return (this.checkoutForm.get('direccion') as FormGroup).controls; }
  get c() { return (this.checkoutForm.get('contacto') as FormGroup).controls; }
}

