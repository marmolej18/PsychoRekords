// src/app/features/admin/inventario/inventario.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { CONDICIONES_PRODUCTO, Producto, ProductosService, urlPortada } from '../services/productos.service';
import { Observable, of, throwError } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
// Declarar 'window' para poder usar el modal de Bootstrap
declare let bootstrap: any;

@Component({
  selector: 'app-inventario',
  templateUrl: './inventario.component.html',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  styleUrls: ['./inventario.component.css']
})
export class InventarioComponent implements OnInit {

  productos: Producto[] = [];
  loading = true;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  // Propiedades para el formulario modal
  productoForm!: FormGroup;
  isEditMode = false;
  currentProductId: number | null = null;
  formSubmitting = false;
  modalTitle = '';

  // Portada del disco: archivo elegido (se sube al guardar) y vista previa en el modal
  readonly urlPortada = urlPortada;
  archivoPortada: File | null = null;
  vistaPrevia: string | null = null;
  errorPortada = '';
  private readonly TIPOS_PORTADA = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly MAX_PORTADA = 2 * 1024 * 1024;

  // Opciones para los selectores
  formatos = ['Vinilo', 'CD', 'Cassette'];
  // Lista fija compartida con el filtro de condición del catálogo
  condicionesDisponibles = CONDICIONES_PRODUCTO;
  // Asumiendo que hay un catálogo de géneros, por ahora es libre.

  constructor(
    private authService: AuthService,
    private productosService: ProductosService,
    private router: Router,
    private fb: FormBuilder
  ) { }

  ngOnInit(): void {
    // 1. Verificar si es administrador (Ruta de seguridad)
    this.authService.isAdmin$.subscribe(isAdmin => {
      if (!isAdmin) {
        this.router.navigate(['/']); // Redirigir si no es admin
      } else {
        this.cargarProductos();
      }
    });

    // 2. Inicializar el formulario con todos los campos del producto
    this.productoForm = this.fb.group({
      titulo: ['', Validators.required],
      artista: ['', Validators.required],
      generomus: [''],
      aniolanzam: ['', [Validators.min(1900), Validators.max(new Date().getFullYear())]],
      formato: ['', Validators.required],
      condiciones: [''],
      cantstock: [0, [Validators.required, Validators.min(0)]],
      precio: [0.00, [Validators.required, Validators.min(0.01)]],
    });
  }

  /**
   * Carga la lista completa de productos.
   */
  cargarProductos(): void {
    this.loading = true;
    this.errorMessage = null;
    this.productosService.getProductos().subscribe({
      next: (data) => {
        // Mapear el precio de string a number, si es necesario
        this.productos = data.map(p => ({ ...p, precio: Number(p.precio) }));
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = 'Error al cargar el inventario.';
        console.error('Error al cargar productos:', err);
      }
    });
  }

  // --- GESTIÓN DEL MODAL Y FORMULARIO ---

  /**
   * Prepara el modal para CREAR un nuevo producto.
   */
  abrirModalCrear(): void {
    this.isEditMode = false;
    this.currentProductId = null;
    this.modalTitle = 'Crear Nuevo Producto';
    this.productoForm.reset({ cantStock: 0, precio: 0.00 });
    this.limpiarPortada(null);
    this.showModal();
  }

  /**
   * Prepara el modal para EDITAR un producto existente.
   */
  abrirModalEditar(producto: Producto): void {
    this.isEditMode = true;
    this.currentProductId = producto.idprod;
    this.modalTitle = `Editar Producto: ${producto.titulo}`;

    // Cargar los valores del producto en el formulario
    this.productoForm.patchValue({
      titulo: producto.titulo,
      artista: producto.artista,
      generomus: producto.generomus,
      aniolanzam: producto.aniolanzam,
      formato: producto.formato,
      condiciones: producto.condiciones,
      cantstock: producto.cantstock,
      precio: producto.precio
    });
    this.limpiarPortada(urlPortada(producto));
    this.showModal();
  }

  /** Valida la imagen elegida (tipo y tamaño) y muestra su vista previa; se sube al guardar. */
  onPortadaSeleccionada(evento: Event): void {
    const input = evento.target as HTMLInputElement;
    const archivo = input.files?.[0];
    if (!archivo) return;
    if (!this.TIPOS_PORTADA.includes(archivo.type)) {
      this.errorPortada = 'La portada debe ser una imagen JPG, PNG o WEBP.';
      input.value = '';
      return;
    }
    if (archivo.size > this.MAX_PORTADA) {
      this.errorPortada = 'La portada no puede pesar más de 2 MB.';
      input.value = '';
      return;
    }
    this.limpiarPortada(URL.createObjectURL(archivo));
    this.archivoPortada = archivo;
  }

  /** Quita la imagen elegida y deja como vista previa la indicada (la portada actual o ninguna). */
  private limpiarPortada(vistaPrevia: string | null): void {
    if (this.vistaPrevia?.startsWith('blob:')) URL.revokeObjectURL(this.vistaPrevia);
    this.archivoPortada = null;
    this.errorPortada = '';
    this.vistaPrevia = vistaPrevia;
  }

  /** Si la portada por título no existe, la vista previa se oculta en vez de mostrar una imagen rota. */
  onVistaPreviaError(): void {
    this.vistaPrevia = null;
  }

  /**
   * Muestra el modal de Bootstrap.
   */
  showModal(): void {
    const modalElement = document.getElementById('productoModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  /**
   * Oculta el modal de Bootstrap.
   */
  hideModal(): void {
    const modalElement = document.getElementById('productoModal');
    if (modalElement) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      if (modal) {
        modal.hide();
      }
    }
  }

  /**
   * Maneja el envío del formulario (Crear o Editar).
   */
  onSubmit(): void {
    this.errorMessage = null;
    this.successMessage = null;

    if (this.productoForm.invalid) {
      this.productoForm.markAllAsTouched();
      this.errorMessage = 'Por favor, completa todos los campos requeridos y válidos.';
      return;
    }

    this.formSubmitting = true;
    const productoData = this.productoForm.value;

    let request$: Observable<any>;

    if (this.isEditMode && this.currentProductId) {
      // Editar
      request$ = this.productosService.actualizarProducto(this.currentProductId, productoData);
    } else {
      // Crear
      request$ = this.productosService.crearProducto(productoData);
    }

    // Primero se guardan los datos del disco; si se eligió una portada, se sube después con su id.
    const archivo = this.archivoPortada;
    request$.pipe(
      switchMap(response => archivo
        ? this.productosService.subirImagen(response.producto.idprod, archivo).pipe(
            switchMap(() => of({ ...response, message: `${response.message} Portada actualizada.` })),
            catchError(err => {
              // El disco ya se guardó: si se reintenta, debe editarse ese mismo disco, no crear otro.
              this.isEditMode = true;
              this.currentProductId = response.producto.idprod;
              this.cargarProductos();
              return throwError(() => ({
                error: { message: `El disco se guardó, pero la portada no: ${err.error?.message || 'intenta de nuevo.'}` }
              }));
            }))
        : of(response))
    ).subscribe({
      next: (response) => {
        this.formSubmitting = false;
        this.limpiarPortada(null);
        this.successMessage = response.message;
        this.hideModal();
        this.cargarProductos(); // Recargar la tabla
        setTimeout(() => this.successMessage = null, 3000); // Limpiar mensaje de éxito
      },
      error: (err) => {
        this.formSubmitting = false;
        this.errorMessage = err.error?.message || `Error al ${this.isEditMode ? 'editar' : 'crear'} el producto.`;
        console.error('Error CRUD:', err);
      }
    });
  }

  /**
   * Función de ayuda para acceder fácilmente a los controles
   */
  get f() { return this.productoForm.controls; }
}