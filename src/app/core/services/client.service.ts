import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, shareReplay, throwError, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Coordinates {
  origin_latitude: number;
  origin_longitude: number;
  destination_latitude: number;
  destination_longitude: number;
}

export interface RideRequestData extends Coordinates {
  origin_name: string;
  destination_name: string;
}

export interface FareBreakdown {
  base_fare: number;
  price_per_km: number;
  price_per_minute: number;
  minimum_fare: number;
  surge_multiplier: number;
}

export interface FareEstimate {
  distance_km: number;
  duration_min: number;
  estimated_fare: number;
  currency: string;
  fare_breakdown: FareBreakdown;
}

export interface RatingData {
  score: number;
  comment?: string;
  has_incident: boolean;
}

@Injectable({ providedIn: 'root' })
export class ClientService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  private fare$: Observable<any> | null = null;
  private fareAt = 0;

  /** GET /api/fares/active (público). Se guarda 1 minuto para no repetir la consulta en cada pantalla. */
  activeFare(): Observable<any> {
    if (!this.fare$ || Date.now() - this.fareAt > 60000) {
      this.fareAt = Date.now();
      this.fare$ = this.http.get<any>(`${this.api}/fares/active`).pipe(
        shareReplay(1),
        catchError((err) => {
          this.fare$ = null;
          return throwError(() => err);
        }),
      );
    }
    return this.fare$;
  }

  /** POST /api/client/estimate-fare */
  estimateFare(data: Coordinates): Observable<{ success: boolean; estimate: FareEstimate }> {
    return this.http
      .post<{ success: boolean; estimate: FareEstimate }>(`${this.api}/client/estimate-fare`, data)
      .pipe(timeout(20000));
  }

  /** POST /api/client/ride-requests */
  createRideRequest(data: RideRequestData): Observable<any> {
    return this.http.post<any>(`${this.api}/client/ride-requests`, data).pipe(timeout(20000));
  }

  /** GET /api/client/active */
  active(): Observable<any> {
    return this.http.get<any>(`${this.api}/client/active`).pipe(timeout(15000));
  }

  /** POST /api/client/cancel/{id} */
  cancel(id: number, reason: string): Observable<any> {
    return this.http.post<any>(`${this.api}/client/cancel/${id}`, { reason });
  }

  /** GET /api/client/trips */
  trips(page = 1): Observable<any> {
    // Respuesta paginada de Laravel: { trips: { data, current_page, last_page } }
    return this.http.get<any>(`${this.api}/client/trips`, { params: { page } });
  }

  /** POST /api/client/trips/{id}/rating */
  rate(tripId: number, data: RatingData): Observable<any> {
    return this.http.post<any>(`${this.api}/client/trips/${tripId}/rating`, data);
  }
}
