import { Validators } from '@angular/forms';

// Reglas de validación de datos de usuario, compartidas por el registro y la gestión de usuarios (admin).

// Letras (incluye acentos, ü y ñ), con palabras separadas por un espacio, guion o apóstrofo.
// Se permiten espacios al inicio/fin porque se recortan al guardar.
export const PATRON_NOMBRE = /^\s*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?:[ '-][A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+)*\s*$/;
// usuario@dominio.ext — exige al menos un punto en el dominio y una extensión de 2+ letras
export const PATRON_EMAIL = /^\s*[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\s*$/;
// 10 dígitos, igual que en el checkout
export const PATRON_TELEFONO = /^\d{10}$/;

// Validadores listos para usar en FormBuilder (los límites coinciden con el backend y la BD)
export const validadoresNombre = (obligatorio: boolean) => [
  ...(obligatorio ? [Validators.required] : []),
  Validators.maxLength(50),
  Validators.pattern(PATRON_NOMBRE)
];
export const validadoresEmail = [Validators.required, Validators.maxLength(100), Validators.pattern(PATRON_EMAIL)];
export const validadoresTelefono = [Validators.pattern(PATRON_TELEFONO)];
// Código postal de 5 dígitos, igual que en el checkout
export const validadoresCP = [Validators.pattern(/^\d{5}$/)];

/** Recorta un texto opcional; devuelve null si queda vacío. */
export const limpiarOpcional = (v: string | null | undefined): string | null => v?.trim() || null;
