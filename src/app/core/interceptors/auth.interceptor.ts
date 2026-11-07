import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, tap, throwError, timeout } from 'rxjs';
import { UiRefresh } from '../utils/ui-refresh';
import { appStorage } from '../utils/storage';

/** Tiempo máximo de espera de cualquier petición a la API (antes podía quedarse girando sin fin). */
const DEFAULT_TIMEOUT_MS = 20000;

/** Agrega Accept/Content-Type JSON y el token JWT; si el token vence (401) vuelve al login. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = appStorage.getItem('token');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const ui = inject(UiRefresh);
  return next(req.clone({ setHeaders: headers })).pipe(
    timeout({ first: DEFAULT_TIMEOUT_MS }),
    // Repintar la pantalla apenas llega la respuesta (o el error) — ver ui-refresh.ts
    finalize(() => ui.request()),
    tap({ next: () => ui.request() }),
    catchError((err: HttpErrorResponse) => {
      const isAuthCall = req.url.includes('/auth/login') || req.url.includes('/auth/register') || req.url.includes('/auth/logout');
      if (err.status === 401 && token && !isAuthCall) {
        appStorage.removeItem('token');
        appStorage.removeItem('user');
        router.navigateByUrl('/login', { replaceUrl: true });
      }
      return throwError(() => err);
    }),
  );
};
