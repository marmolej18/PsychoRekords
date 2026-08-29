import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-registro-usuario',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './registro-usuario.component.html',
  styleUrl: './registro-usuario.component.css'
})
export class RegistroUsuarioComponent implements OnInit {
  registroForm!: FormGroup;
  errorMessage: string | null = null;
  successMessage: string | null = null;
  loading: boolean = false;
  private apiUrl = `http://localhost:3000/api/usuarios/registro`;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient, // Usamos HttpClient directamente para el registro simple
    private router: Router
  ) { }

  ngOnInit(): void {
    // Inicializa el formulario con todos los campos de la tabla Usuario
    this.registroForm = this.fb.group({
      // Datos Personales
      nombre: ['', Validators.required],
      apellidoP: ['', Validators.required],
      apellidoM: [''], // Opcional

      // Contacto y Credenciales (ASUMIMOS CAMPO PASSWORD)
      correoElectronico: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]], // Asumimos un mínimo de 6 caracteres
      telefono: [''],

      // Dirección
      CP: [''],
      calle: [''],
      colonia: [''],
      numCasa: [''],
      ciudad: [''],
      estado: ['']
    });
  }

  onSubmit(): void {
    this.errorMessage = null;
    this.successMessage = null;

    if (this.registroForm.invalid) {
      this.registroForm.markAllAsTouched();
      this.errorMessage = 'Por favor, completa todos los campos obligatorios.';
      return;
    }

    this.loading = true;

    // Tu API de Node.js espera todos estos campos en el cuerpo (body)
    this.http.post<any>(this.apiUrl, this.registroForm.value).subscribe({
      next: (response) => {
        this.loading = false;
        this.successMessage = response.message || 'Registro exitoso. Serás redirigido al inicio de sesión.';

        // Redirigir al login después de un breve retraso
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 3000);
      },
      error: (err) => {
        this.loading = false;
        // La API devuelve un 409 si el correo ya existe
        if (err.status === 409) {
          this.errorMessage = 'El correo electrónico ya está registrado. Intenta iniciar sesión.';
        } else {
          this.errorMessage = err.error?.message || 'Ocurrió un error inesperado durante el registro.';
        }
        console.error('Error de Registro:', err);
      }
    });
  }

  // Función de ayuda para acceder fácilmente a los controles
  get f() { return this.registroForm.controls; }
}