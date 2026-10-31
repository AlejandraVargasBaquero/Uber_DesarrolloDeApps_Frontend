import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
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

  /** GET /api/fares/active (público) */
  activeFare(): Observable<any> {
    return this.http.get<any>(`${this.api}/fares/active`);
  }

  /** POST /api/client/estimate-fare */
  estimateFare(data: Coordinates): Observable<{ success: boolean; estimate: FareEstimate }> {
    return this.http.post<{ success: boolean; estimate: FareEstimate }>(`${this.api}/client/estimate-fare`, data);
  }

  /** POST /api/client/ride-requests */
  createRideRequest(data: RideRequestData): Observable<any> {
    return this.http.post<any>(`${this.api}/client/ride-requests`, data);
  }

  /** GET /api/client/active */
  active(): Observable<any> {
    return this.http.get<any>(`${this.api}/client/active`);
  }

  /** POST /api/client/cancel/{id} */
  cancel(id: number, reason: string): Observable<any> {
    return this.http.post<any>(`${this.api}/client/cancel/${id}`, { reason });
  }

  /** GET /api/client/trips */
  trips(page = 1): Observable<any> {
    return this.http.get<any>(`${this.api}/client/trips`, { params: { page } });
  }

  /** POST /api/client/trips/{id}/rating */
  rate(tripId: number, data: RatingData): Observable<any> {
    return this.http.post<any>(`${this.api}/client/trips/${tripId}/rating`, data);
  }
}
