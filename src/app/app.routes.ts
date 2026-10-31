import type { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Públicas
  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./pages/forgot-password/forgot-password.page').then((m) => m.ForgotPasswordPage),
  },

  // Cliente
  {
    path: 'client',
    canActivate: [roleGuard('client')],
    loadComponent: () => import('./pages/client/home/client-home.page').then((m) => m.ClientHomePage),
  },
  {
    path: 'client/trips',
    canActivate: [roleGuard('client')],
    loadComponent: () => import('./pages/client/trips/client-trips.page').then((m) => m.ClientTripsPage),
  },
  {
    path: 'client/trips/:id/rate',
    canActivate: [roleGuard('client')],
    loadComponent: () => import('./pages/client/rate/client-rate.page').then((m) => m.ClientRatePage),
  },

  // Conductor / admin (pantalla general por ahora)
  {
    path: 'home',
    canActivate: [authGuard],
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },

  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
