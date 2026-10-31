import { HttpErrorResponse } from '@angular/common/http';

/** Convierte un error de la API en un mensaje legible para el usuario. */
export function apiErrorMessage(err: HttpErrorResponse, fallback = 'Ocurrió un error'): string {
  if (err.status === 0) {
    return 'No se pudo conectar con el servidor. Verifica tu red.';
  }
  // Errores de validación de Laravel (422): { message, errors: { campo: [mensajes] } }
  const errors = err.error?.errors;
  if (errors && typeof errors === 'object') {
    const first = Object.values(errors)[0];
    if (Array.isArray(first) && first.length) {
      return String(first[0]);
    }
  }
  if (err.status === 401) {
    return err.error?.message ?? 'Sesión expirada o credenciales incorrectas';
  }
  return err.error?.message ?? fallback;
}
