import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FareData {
  name: string;
  base_fare: number;
  price_per_km: number;
  price_per_minute: number;
  minimum_fare: number;
  surge_multiplier: number;
  active: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/admin`;

  /** GET /api/admin/dashboard */
  dashboard(): Observable<any> {
    return this.http.get<any>(`${this.api}/dashboard`);
  }

  /** GET /api/admin/drivers?approval_status= */
  drivers(approvalStatus?: string): Observable<any> {
    let params = new HttpParams();
    if (approvalStatus) params = params.set('approval_status', approvalStatus);
    return this.http.get<any>(`${this.api}/drivers`, { params });
  }

  /** PATCH /api/admin/drivers/{id}/approval */
  setApproval(driverId: number, approvalStatus: 'approved' | 'rejected' | 'suspended' | 'pending', notes?: string): Observable<any> {
    return this.http.patch<any>(`${this.api}/drivers/${driverId}/approval`, {
      approval_status: approvalStatus,
      admin_notes: notes ?? '',
    });
  }

  /** GET /api/admin/fares */
  fares(): Observable<any> {
    return this.http.get<any>(`${this.api}/fares`);
  }

  /** POST /api/admin/fares */
  createFare(data: FareData): Observable<any> {
    return this.http.post<any>(`${this.api}/fares`, data);
  }

  /** GET /api/admin/trips */
  trips(filters: { status?: string; driver_id?: string; client_id?: string; date?: string } = {}): Observable<any> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params = params.set(k, v);
    });
    return this.http.get<any>(`${this.api}/trips`, { params });
  }

  /** GET /api/admin/reports */
  reports(): Observable<any> {
    return this.http.get<any>(`${this.api}/reports`);
  }

  /** GET /api/admin/audit-logs */
  auditLogs(): Observable<any> {
    return this.http.get<any>(`${this.api}/audit-logs`);
  }

  /** GET /api/fares/active (público) */
  activeFare(): Observable<any> {
    return this.http.get<any>(`${environment.apiUrl}/fares/active`);
  }
}

/** Convierte arreglos, colecciones paginadas ({ data: [] }) u objetos indexados ({ "3": {...} }) en arreglo. */
function toArray(v: any): any[] | null {
  if (Array.isArray(v)) return v;
  if (Array.isArray(v?.data)) return v.data;
  if (v && typeof v === 'object') {
    const vals = Object.values(v);
    if (vals.length && vals.every((x: any) => x && typeof x === 'object' && 'id' in x)) return vals as any[];
  }
  return null;
}

/**
 * Extrae la lista de una respuesta de la API.
 * Primero busca en las claves indicadas; si no, busca la primera lista de registros (con "id")
 * en cualquier parte de la respuesta (hasta 3 niveles).
 */
export function asList(res: any, ...keys: string[]): any[] {
  const direct = toArray(res);
  if (direct && (direct.length === 0 || typeof direct[0] === 'object')) {
    if (Array.isArray(res) || Array.isArray(res?.data)) return direct;
  }
  for (const k of keys) {
    const v = toArray(res?.[k]);
    if (v) return v;
    const nested = toArray(res?.data?.[k]);
    if (nested) return nested;
  }
  const seen = new Set<any>();
  const search = (node: any, depth: number): any[] | null => {
    if (!node || typeof node !== 'object' || depth > 3 || seen.has(node)) return null;
    seen.add(node);
    const arr = toArray(node);
    if (arr && arr.length && typeof arr[0] === 'object' && 'id' in arr[0] && node !== res) return arr;
    for (const v of Object.values(node)) {
      const found = search(v, depth + 1);
      if (found) return found;
    }
    return null;
  };
  return search(res, 0) ?? [];
}
