// src/app/features/admin/inventario/inventario.component.ts
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthService } from '../services/auth.service';
import { Producto, ProductosService } from '../services/productos.service';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
// Declarar 'window' para poder usar el modal de Bootstrap
declare var bootstrap: any;

@Component({
  selector: 'app-inventario',
  templateUrl: './inventario.component.html',
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  styleUrls: ['./inventario.component.css']
})
export class InventarioComponent implements OnInit {

  productos: Producto[] = [];
  loading: boolean = true;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  // Propiedades para el formulario modal
  productoForm!: FormGroup;
  isEditMode: boolean = false;
  currentProductId: number | null = null;
  formSubmitting: boolean = false;
  modalTitle: string = '';

  // Opciones para los selectores
  formatos = ['Vinilo', 'CD', 'Cassette'];
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
    this.showModal();
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

    request$.subscribe({
      next: (response) => {
        this.formSubmitting = false;
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