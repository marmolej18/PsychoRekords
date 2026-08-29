import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  errorMessage: string | null = null;
  loading: boolean = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    // Inicializa el formulario reactivo
    this.loginForm = this.fb.group({
      correoElectronico: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  onSubmit(): void {
    this.errorMessage = null; // Limpiar mensajes de error

    if (this.loginForm.invalid) {
      // Marcar todos los campos como tocados para mostrar errores
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    const { correoElectronico, password } = this.loginForm.value;

    this.authService.login(correoElectronico, password).subscribe({
      next: (response: any) => {
        this.loading = false;
        // Navegar a la página de inicio o al panel de admin si aplica
        const userRole = response.usuario.rol;
        if (userRole === 'admin') {
          this.router.navigate(['/admin/dashboard']); // Redirigir a Admin Dashboard
        } else {
          this.router.navigate(['/inicio']);
        }
      },
      error: (err: any) => {
        this.loading = false;
        // Tu API devuelve un mensaje de error 401: 'Correo o contraseña incorrectos.'
        this.errorMessage = err.error?.message || 'Error de conexión. Intente más tarde.';
        console.error('Error de Login:', err);
      }
    });
  }

  // Getters para fácil acceso a los controles del formulario en la plantilla
  get email() {
    return this.loginForm.get('correoElectronico');
  }

  get password() {
    return this.loginForm.get('password');
  }
}