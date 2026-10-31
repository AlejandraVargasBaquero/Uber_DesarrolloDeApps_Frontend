import { HttpInterceptorFn } from '@angular/common/http';

/** Agrega Accept: application/json y el token JWT a todas las peticiones. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return next(req.clone({ setHeaders: headers }));
};
