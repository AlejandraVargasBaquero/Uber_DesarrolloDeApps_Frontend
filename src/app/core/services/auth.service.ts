import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';

export type Role = 'admin' | 'client' | 'driver';

export interface User {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  status: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface RegisterData {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: 'client' | 'driver';
  // Solo conductor
  license_number?: string;
  plate?: string;
  brand?: string;
  model?: string;
  year?: number;
  capacity?: number;
  color?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  /** POST /api/auth/login */
  login(login: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.api}/auth/login`, { login, password })
      .pipe(tap((res) => this.saveSession(res)));
  }

  /** POST /api/auth/register */
  register(data: RegisterData): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.api}/auth/register`, data)
      .pipe(tap((res) => this.saveSession(res)));
  }

  /** POST /api/auth/forgot-password */
  forgotPassword(email: string, newPassword: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(`${this.api}/auth/forgot-password`, {
      email,
      new_password: newPassword,
    });
  }

  /** GET /api/auth/me */
  me(): Observable<{ success: boolean; user: User }> {
    return this.http.get<{ success: boolean; user: User }>(`${this.api}/auth/me`);
  }

  /** POST /api/auth/logout */
  logout(): Observable<unknown> {
    return this.http.post(`${this.api}/auth/logout`, {}).pipe(tap(() => this.clearSession()));
  }

  saveSession(res: AuthResponse): void {
    localStorage.setItem('token', res.access_token);
    localStorage.setItem('user', JSON.stringify(res.user));
  }

  clearSession(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  get token(): string | null {
    return localStorage.getItem('token');
  }

  get user(): User | null {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as User) : null;
  }

  isLoggedIn(): boolean {
    return !!this.token;
  }

  /** Pantalla de inicio según el rol del usuario. */
  homeFor(role?: Role): string {
    switch (role) {
      case 'client':
        return '/client';
      default:
        // Conductor y admin: pantalla general por ahora
        return '/home';
    }
  }
}
