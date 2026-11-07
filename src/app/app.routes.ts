import type { Routes } from '@angular/router';
import { roleGuard } from './core/guards/auth.guard';

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

  // Pasajero
  {
    path: 'client',
    canActivate: [roleGuard('client')],
    loadComponent: () => import('./pages/client/home/client-home.page').then((m) => m.ClientHomePage),
  },
  {
    path: 'client/trip',
    canActivate: [roleGuard('client')],
    loadComponent: () => import('./pages/client/trip/client-trip.page').then((m) => m.ClientTripPage),
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

  // Conductor
  {
    path: 'driver',
    canActivate: [roleGuard('driver')],
    loadComponent: () => import('./pages/driver/home/driver-home.page').then((m) => m.DriverHomePage),
  },
  {
    path: 'driver/trip',
    canActivate: [roleGuard('driver')],
    loadComponent: () => import('./pages/driver/trip/driver-trip.page').then((m) => m.DriverTripPage),
  },

  // Administrador
  {
    path: 'admin',
    canActivate: [roleGuard('admin')],
    loadComponent: () => import('./pages/admin/admin.page').then((m) => m.AdminPage),
  },

  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
