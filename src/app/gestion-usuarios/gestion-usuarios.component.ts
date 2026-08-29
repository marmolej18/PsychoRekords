import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, UserAdmin } from '../services/auth.service';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

declare var bootstrap: any; // Para usar el modal de Bootstrap

@Component({
  selector: 'app-gestion-usuarios',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './gestion-usuarios.component.html',
  styleUrl: './gestion-usuarios.component.css'
})
export class GestionUsuariosComponent implements OnInit {

  users: UserAdmin[] = [];
  loading: boolean = true;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  // Propiedades del formulario modal
  userForm!: FormGroup;
  currentUser: UserAdmin | null = null;
  formSubmitting: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private fb: FormBuilder
  ) { }

  ngOnInit(): void {
    // 1. Verificación de Rol Admin (Ya debería estar en el router guard, pero es bueno tener una doble verificación)
    this.authService.isAdmin$.subscribe(isAdmin => {
      if (!isAdmin) {
        this.router.navigate(['/']);
      } else {
        this.cargarUsuarios();
      }
    });

    // 2. Inicializar formulario (solo los campos editables por ahora)
    this.userForm = this.fb.group({
      nombre: ['', Validators.required],
      apellidoP: ['', Validators.required],
      apellidoM: [''],
      correoElectronico: ['', [Validators.required, Validators.email]],
      telefono: [''],
      rol: ['', Validators.required], // Permitir cambiar el rol
      // Puedes añadir aquí todos los campos de dirección si quieres que el admin los edite
    });
  }

  /**
   * Carga la lista completa de usuarios.
   */
  cargarUsuarios(): void {
    this.loading = true;
    this.errorMessage = null;

    this.authService.getAllUsers().subscribe({
      next: (data) => {
        this.users = data;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = 'Error al cargar la lista de usuarios. Verifica los permisos de administrador.';
        console.error('Error al cargar usuarios:', err);
      }
    });
  }

  /**
   * Prepara el modal para editar un usuario.
   */
  abrirModalEditar(user: UserAdmin): void {
    this.currentUser = user;
    this.userForm.patchValue({
      nombre: user.nombre,
      apellidoP: user.apellidoP,
      apellidoM: user.apellidoM,
      correoElectronico: user.correoElectronico,
      telefono: user.telefono,
      rol: user.rol,
      // ... otros campos
    });
    this.showModal();
  }

  /**
   * Muestra el modal de Bootstrap.
   */
  showModal(): void {
    const modalElement = document.getElementById('userModal');
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }

  /**
   * Oculta el modal de Bootstrap.
   */
  hideModal(): void {
    const modalElement = document.getElementById('userModal');
    if (modalElement) {
      const modal = bootstrap.Modal.getInstance(modalElement);
      if (modal) {
        modal.hide();
      }
    }
  }

  /**
   * Maneja el envío del formulario para actualizar el usuario.
   */
  onSubmit(): void {
    this.errorMessage = null;
    this.successMessage = null;

    if (this.userForm.invalid || !this.currentUser) {
      this.userForm.markAllAsTouched();
      this.errorMessage = 'Formulario incompleto o sin usuario seleccionado.';
      return;
    }

    this.formSubmitting = true;

    this.authService.updateUser(this.currentUser.idUsuario, this.userForm.value).subscribe({
      next: (response) => {
        this.formSubmitting = false;
        this.successMessage = response.message || 'Usuario actualizado exitosamente.';
        this.hideModal();
        this.cargarUsuarios(); // Recargar la tabla
        setTimeout(() => this.successMessage = null, 3000);
      },
      error: (err) => {
        this.formSubmitting = false;
        this.errorMessage = err.error?.message || 'Error al actualizar el usuario.';
        console.error('Error al actualizar usuario:', err);
      }
    });
  }

  /**
   * Elimina un usuario (soft delete si es posible).
   */
  eliminarUsuario(id: number, nombre: string): void {
    if (confirm(`¿Estás seguro de que quieres ELIMINAR al usuario ${nombre} (ID: ${id})? Esta acción es irreversible.`)) {
      this.authService.deleteUser(id).subscribe({
        next: (response) => {
          this.successMessage = response.message || `Usuario ${nombre} eliminado exitosamente.`;
          this.cargarUsuarios(); // Recargar la tabla
          setTimeout(() => this.successMessage = null, 3000);
        },
        error: (err) => {
          this.errorMessage = err.error?.message || 'Error al eliminar el usuario.';
          console.error('Error al eliminar usuario:', err);
        }
      });
    }
  }

  get f() { return this.userForm.controls; }
}
