import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService, UserAdmin } from '../services/auth.service';
import {
  limpiarOpcional, validadoresCP, validadoresEmail, validadoresNombre, validadoresTelefono
} from '../validadores/usuario.validators';

const CAMPOS_DIRECCION = ['calle', 'numCasa', 'colonia', 'CP', 'ciudad', 'estado'];

/** La confirmación debe coincidir con la nueva contraseña, y la nueva debe ser distinta de la actual. */
function validarPasswords(group: AbstractControl): ValidationErrors | null {
  const actual = group.get('passwordActual')?.value;
  const nueva = group.get('passwordNueva')?.value;
  const confirmar = group.get('confirmarPassword')?.value;
  const errores: ValidationErrors = {};
  if (nueva && actual && nueva === actual) errores['igualActual'] = true;
  if (confirmar && nueva !== confirmar) errores['noCoincide'] = true;
  return Object.keys(errores).length ? errores : null;
}

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './perfil.component.html',
  styleUrl: './perfil.component.css'
})
export class PerfilComponent implements OnInit {
  perfil: UserAdmin | null = null;
  perfilForm!: FormGroup;
  cargando = true;
  guardando = false;
  error = '';

  passwordForm!: FormGroup;
  cambiandoPassword = false;

  constructor(
    private authService: AuthService,
    private fb: FormBuilder,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.perfilForm = this.fb.group({
      nombre: ['', validadoresNombre(true)],
      apellidoP: ['', validadoresNombre(true)],
      apellidoM: ['', validadoresNombre(false)],
      correoElectronico: ['', validadoresEmail],
      telefono: ['', validadoresTelefono],
      calle: ['', Validators.maxLength(100)],
      numCasa: ['', Validators.maxLength(20)],
      colonia: ['', Validators.maxLength(100)],
      CP: ['', validadoresCP],
      ciudad: ['', Validators.maxLength(50)],
      estado: ['', Validators.maxLength(50)],
    });

    this.passwordForm = this.fb.group({
      passwordActual: ['', Validators.required],
      passwordNueva: ['', [Validators.required, Validators.minLength(8)]],
      confirmarPassword: ['', Validators.required],
    }, { validators: validarPasswords });

    if (!this.authService.getAuthHeader()) {
      this.router.navigate(['/login']);
      return;
    }
    this.cargarPerfil();
  }

  cargarPerfil(): void {
    this.cargando = true;
    this.error = '';
    this.authService.getMiPerfil().subscribe({
      next: perfil => {
        this.perfil = perfil;
        this.llenarFormulario(perfil);
        this.cargando = false;
      },
      error: () => {
        this.error = 'No pudimos cargar tu perfil. Intenta nuevamente.';
        this.cargando = false;
      }
    });
  }

  /** Carga los datos en el formulario y marca los que ya no cumplen las reglas para que se vea el motivo. */
  private llenarFormulario(p: UserAdmin): void {
    this.perfilForm.reset({
      nombre: p.nombre ?? '',
      apellidoP: p.apellidoP ?? '',
      apellidoM: p.apellidoM ?? '',
      correoElectronico: p.correoElectronico ?? '',
      telefono: p.telefono ?? '',
      calle: p.calle ?? '',
      numCasa: p.numCasa ?? '',
      colonia: p.colonia ?? '',
      CP: p.CP ?? '',
      ciudad: p.ciudad ?? '',
      estado: p.estado ?? '',
    });
    // El admin no ve la dirección: se deshabilita para que no cuente en la validación
    // (al guardar se reenvía su valor actual con getRawValue, así no se borra)
    CAMPOS_DIRECCION.forEach(campo => {
      const c = this.perfilForm.get(campo)!;
      if (p.rol === 'admin') c.disable(); else c.enable();
    });
    Object.values(this.perfilForm.controls).forEach(c => {
      if (c.invalid) c.markAsTouched();
    });
  }

  descartarCambios(): void {
    if (this.perfil) this.llenarFormulario(this.perfil);
  }

  guardar(): void {
    if (this.perfilForm.invalid) {
      this.perfilForm.markAllAsTouched();
      return;
    }

    const v = this.perfilForm.getRawValue();
    const datos: Partial<UserAdmin> = {
      nombre: v.nombre.trim(),
      apellidoP: v.apellidoP.trim(),
      apellidoM: limpiarOpcional(v.apellidoM),
      correoElectronico: v.correoElectronico.trim(),
      telefono: limpiarOpcional(v.telefono),
      calle: limpiarOpcional(v.calle),
      numCasa: limpiarOpcional(v.numCasa),
      colonia: limpiarOpcional(v.colonia),
      CP: limpiarOpcional(v.CP),
      ciudad: limpiarOpcional(v.ciudad),
      estado: limpiarOpcional(v.estado),
    };

    this.guardando = true;
    this.authService.actualizarMiPerfil(datos).subscribe({
      next: ({ message, usuario }) => {
        this.guardando = false;
        this.perfil = usuario;
        this.llenarFormulario(usuario);
        Swal.fire({
          icon: 'success',
          title: message || 'Perfil actualizado',
          toast: true,
          position: 'top-end',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: err => {
        this.guardando = false;
        console.error('Error al actualizar el perfil:', err);
        Swal.fire({
          icon: 'error',
          title: 'No se pudo guardar',
          text: err.error?.message || 'Ocurrió un error al actualizar tu perfil.',
          confirmButtonText: 'Entendido'
        });
      }
    });
  }

  cambiarPassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { passwordActual, passwordNueva } = this.passwordForm.value;
    this.cambiandoPassword = true;
    this.authService.cambiarMiPassword(passwordActual, passwordNueva).subscribe({
      next: ({ message }) => {
        this.cambiandoPassword = false;
        this.passwordForm.reset();
        Swal.fire({
          icon: 'success',
          title: message || 'Contraseña actualizada',
          toast: true,
          position: 'top-end',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: err => {
        this.cambiandoPassword = false;
        console.error('Error al cambiar la contraseña:', err);
        Swal.fire({
          icon: 'error',
          title: 'No se pudo cambiar la contraseña',
          text: err.error?.message || 'Ocurrió un error al cambiar tu contraseña.',
          confirmButtonText: 'Entendido'
        });
      }
    });
  }

  /** Mensaje de error de un campo del formulario de contraseña (incluye los errores del grupo). */
  errorPassword(campo: 'passwordActual' | 'passwordNueva' | 'confirmarPassword'): string {
    const c = this.passwordForm.get(campo)!;
    if (!c.touched) return '';
    if (c.hasError('required')) return 'Este campo es obligatorio.';
    if (c.hasError('minlength')) return 'Debe tener al menos 8 caracteres.';
    if (campo === 'passwordNueva' && this.passwordForm.hasError('igualActual')) return 'Debe ser diferente a la contraseña actual.';
    if (campo === 'confirmarPassword' && this.passwordForm.hasError('noCoincide')) return 'Las contraseñas no coinciden.';
    return '';
  }

  get esAdmin(): boolean {
    return this.perfil?.rol === 'admin';
  }

  get nombreCompleto(): string {
    const p = this.perfil;
    return p ? [p.nombre, p.apellidoP, p.apellidoM].filter(Boolean).join(' ') : '';
  }

  get iniciales(): string {
    const p = this.perfil;
    return p ? `${p.nombre?.[0] ?? ''}${p.apellidoP?.[0] ?? ''}`.toUpperCase() : '';
  }

  invalido(campo: string): boolean {
    const c = this.perfilForm.get(campo);
    return !!c && c.invalid && c.touched;
  }

  /** Mensaje de error para mostrar debajo de un campo. */
  mensajeError(campo: string): string {
    const c = this.perfilForm.get(campo);
    if (!c?.errors) return '';
    if (c.hasError('required')) return 'Este campo es obligatorio.';
    if (c.hasError('maxlength')) return `Máximo ${c.errors['maxlength'].requiredLength} caracteres.`;
    switch (campo) {
      case 'correoElectronico': return 'Ingresa un correo válido, por ejemplo usuario@dominio.com.';
      case 'telefono': return 'Debe tener exactamente 10 dígitos, sin espacios ni guiones.';
      case 'CP': return 'Debe tener exactamente 5 dígitos.';
      default: return 'Solo letras, espacios, guiones y apóstrofos.';
    }
  }
}
