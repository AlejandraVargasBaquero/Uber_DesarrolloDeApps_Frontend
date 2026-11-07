import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';
import { appStorage } from '../utils/storage';

/** Datos del viaje que el conductor aceptó (se guardan en el dispositivo). */
export interface DriverTrip {
  id: number;
  request_id?: number;
  status: 'assigned' | 'driver_arrived' | 'in_progress' | 'completed' | 'cancelled' | string;
  estimated_fare: number;
  final_fare?: number;
  origin_name?: string;
  destination_name?: string;
  origin_latitude?: number;
  origin_longitude?: number;
  destination_latitude?: number;
  destination_longitude?: number;
  estimated_distance_km?: number;
  estimated_duration_min?: number;
  client?: { name?: string; phone?: string };
  accepted_at?: string;
  arrived_at?: string;
  started_at?: string;
  completed_at?: string;
  distance_travelled_km?: number;
  duration_travelled_min?: number;
}

const TRIP_KEY = 'driver_trip';
const EARNINGS_KEY = 'driver_earnings';

@Injectable({ providedIn: 'root' })
export class DriverService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/driver`;

  /** PUT /api/driver/availability */
  setAvailability(status: 'available' | 'unavailable'): Observable<any> {
    return this.http.put<any>(`${this.api}/availability`, { status }).pipe(timeout(15000));
  }

  /** GET /api/driver/ride-requests */
  rideRequests(): Observable<any> {
    return this.http.get<any>(`${this.api}/ride-requests`).pipe(timeout(15000));
  }

  /** POST /api/driver/ride-requests/{id}/accept */
  accept(requestId: number): Observable<any> {
    return this.http.post<any>(`${this.api}/ride-requests/${requestId}/accept`, {}).pipe(timeout(20000));
  }

  /** POST /api/driver/trips/{id}/arrive */
  arrive(tripId: number): Observable<any> {
    return this.http.post<any>(`${this.api}/trips/${tripId}/arrive`, {});
  }

  /** POST /api/driver/trips/{id}/start */
  start(tripId: number): Observable<any> {
    return this.http.post<any>(`${this.api}/trips/${tripId}/start`, {});
  }

  /** POST /api/driver/trips/{id}/complete */
  complete(tripId: number, actualDistanceKm: number, actualDurationMin: number): Observable<any> {
    return this.http.post<any>(`${this.api}/trips/${tripId}/complete`, {
      actual_distance_km: actualDistanceKm,
      actual_duration_min: actualDurationMin,
    });
  }

  /** POST /api/driver/location */
  sendLocation(data: { latitude: number; longitude: number; heading?: number | null; speed?: number | null; trip_id?: number }): Observable<any> {
    const body: Record<string, unknown> = { latitude: data.latitude, longitude: data.longitude };
    if (data.heading != null && !isNaN(data.heading)) body['heading'] = data.heading;
    if (data.speed != null && !isNaN(data.speed)) body['speed'] = data.speed;
    if (data.trip_id) body['trip_id'] = data.trip_id;
    return this.http.post<any>(`${this.api}/location`, body).pipe(timeout(10000));
  }

  // ---------- Estado local (la API no tiene endpoint para consultar el viaje del conductor) ----------

  get currentTrip(): DriverTrip | null {
    try {
      const raw = appStorage.getItem(TRIP_KEY);
      return raw ? (JSON.parse(raw) as DriverTrip) : null;
    } catch {
      return null;
    }
  }

  saveTrip(trip: DriverTrip | null): void {
    if (trip) appStorage.setItem(TRIP_KEY, JSON.stringify(trip));
    else appStorage.removeItem(TRIP_KEY);
  }

  /** Ganancias y viajes del día (registrados desde este dispositivo). */
  todayEarnings(): { total: number; trips: number } {
    const today = new Date().toISOString().slice(0, 10);
    try {
      const data = JSON.parse(appStorage.getItem(EARNINGS_KEY) ?? 'null');
      if (data?.date === today) return { total: data.total ?? 0, trips: data.trips ?? 0 };
    } catch {
      /* ignorar */
    }
    return { total: 0, trips: 0 };
  }

  addEarning(amount: number): void {
    const today = new Date().toISOString().slice(0, 10);
    const cur = this.todayEarnings();
    appStorage.setItem(EARNINGS_KEY, JSON.stringify({ date: today, total: cur.total + (amount || 0), trips: cur.trips + 1 }));
  }
}
