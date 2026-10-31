import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';
import { ClientService, FareEstimate } from '../../../core/services/client.service';
import { apiErrorMessage } from '../../../core/utils/api-error';

const STATUS_LABELS: Record<string, string> = {
  requested: 'Buscando conductor…',
  assigned: 'Conductor asignado, va en camino',
  driver_arrived: 'Tu conductor llegó',
  in_progress: 'Viaje en curso',
  completed: 'Viaje finalizado',
  cancelled: 'Cancelado',
};

@Component({
  selector: 'app-client-home',
  templateUrl: './client-home.page.html',
  styleUrls: ['./client-home.page.scss'],
  imports: [FormsModule, DecimalPipe, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonSpinner],
})
export class ClientHomePage {
  private auth = inject(AuthService);
  private client = inject(ClientService);
  router = inject(Router);

  user = this.auth.user;

  // Viaje / solicitud activa (GET /client/active)
  active: any = null;
  activeType: 'request' | 'trip' | null = null;
  loadingActive = true;

  // Formulario de nuevo viaje
  originName = '';
  originLat: number | null = null;
  originLng: number | null = null;
  destName = '';
  destLat: number | null = null;
  destLng: number | null = null;

  estimate: FareEstimate | null = null;
  estimating = false;
  requesting = false;
  cancelling = false;
  locating = false;

  error = '';
  message = '';

  private pollId: ReturnType<typeof setInterval> | null = null;

  // Ciclo de vida de Ionic: se ejecuta cada vez que entras a la pantalla
  ionViewWillEnter(): void {
    this.user = this.auth.user;
    this.loadActive();
    this.pollId = setInterval(() => this.loadActive(true), 10000);
  }

  ionViewWillLeave(): void {
    if (this.pollId) {
      clearInterval(this.pollId);
      this.pollId = null;
    }
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  loadActive(silent = false): void {
    if (!silent) this.loadingActive = true;
    this.client.active().subscribe({
      next: (res) => {
        this.loadingActive = false;
        if (res.has_active) {
          this.active = res.data;
          this.activeType = res.type;
        } else {
          this.active = null;
          this.activeType = null;
        }
      },
      error: (err) => {
        this.loadingActive = false;
        if (!silent) this.error = apiErrorMessage(err, 'No se pudo consultar tu viaje');
      },
    });
  }

  /** Rellena con el ejemplo de la documentación (Bogotá) para probar rápido. */
  fillExample(): void {
    this.originName = 'Parque de la 93, Calle 93A # 12-50';
    this.originLat = 4.6766;
    this.originLng = -74.0483;
    this.destName = 'Centro Comercial Andino, Carrera 11 # 82-71';
    this.destLat = 4.6664;
    this.destLng = -74.0536;
    this.estimate = null;
  }

  useMyLocation(): void {
    if (!navigator.geolocation) {
      this.error = 'Tu navegador no permite obtener la ubicación';
      return;
    }
    this.locating = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.locating = false;
        this.originLat = +pos.coords.latitude.toFixed(6);
        this.originLng = +pos.coords.longitude.toFixed(6);
        if (!this.originName) this.originName = 'Mi ubicación actual';
        this.estimate = null;
      },
      () => {
        this.locating = false;
        this.error = 'No se pudo obtener tu ubicación';
      },
    );
  }

  private hasCoords(): boolean {
    return [this.originLat, this.originLng, this.destLat, this.destLng].every(
      (v) => v !== null && v !== ('' as any) && !isNaN(Number(v)),
    );
  }

  private coords() {
    return {
      origin_latitude: Number(this.originLat),
      origin_longitude: Number(this.originLng),
      destination_latitude: Number(this.destLat),
      destination_longitude: Number(this.destLng),
    };
  }

  doEstimate(): void {
    this.error = '';
    this.message = '';
    if (!this.hasCoords()) {
      this.error = 'Ingresa las coordenadas de origen y destino';
      return;
    }
    this.estimating = true;
    this.client.estimateFare(this.coords()).subscribe({
      next: (res) => {
        this.estimating = false;
        this.estimate = res.estimate;
      },
      error: (err) => {
        this.estimating = false;
        this.error = apiErrorMessage(err, 'No se pudo calcular la tarifa');
      },
    });
  }

  requestRide(): void {
    this.error = '';
    this.message = '';
    if (!this.originName || !this.destName || !this.hasCoords()) {
      this.error = 'Completa origen y destino';
      return;
    }
    this.requesting = true;
    this.client
      .createRideRequest({
        origin_name: this.originName,
        destination_name: this.destName,
        ...this.coords(),
      })
      .subscribe({
        next: (res) => {
          this.requesting = false;
          this.message = res.message ?? 'Solicitud creada';
          this.estimate = null;
          this.loadActive();
        },
        error: (err) => {
          this.requesting = false;
          this.error = apiErrorMessage(err, 'No se pudo crear la solicitud');
          // 400: ya tiene un viaje activo
          if (err.status === 400) this.loadActive();
        },
      });
  }

  cancel(): void {
    if (!this.active) return;
    if (!confirm('¿Seguro que quieres cancelar?')) return;
    this.cancelling = true;
    this.error = '';
    this.client.cancel(this.active.id, 'Cancelado por el usuario desde la app').subscribe({
      next: (res) => {
        this.cancelling = false;
        this.message = res.message ?? 'Cancelado';
        this.loadActive();
      },
      error: (err) => {
        this.cancelling = false;
        this.error = apiErrorMessage(err, 'No se pudo cancelar');
      },
    });
  }

  logout(): void {
    const done = () => this.router.navigateByUrl('/login', { replaceUrl: true });
    this.auth.logout().subscribe({
      next: done,
      error: () => {
        this.auth.clearSession();
        done();
      },
    });
  }
}
