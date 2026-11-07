import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';
import { DriverService, DriverTrip } from '../../../core/services/driver.service';
import { asList } from '../../../core/services/admin.service';
import { MapService } from '../../../core/services/map.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { cop, initials, km } from '../../../core/utils/format';
import { appStorage } from '../../../core/utils/storage';

const ACCEPT_SECONDS = 15; // HU-07: contador para aceptar

/** Mockup 5 · Conductor · Solicitudes (HU-07) */
@Component({
  selector: 'app-driver-home',
  templateUrl: './driver-home.page.html',
  styleUrls: ['./driver-home.page.scss'],
  imports: [DecimalPipe, IonContent, IonSpinner],
})
export class DriverHomePage {
  private auth = inject(AuthService);
  private driver = inject(DriverService);
  private maps = inject(MapService);
  router = inject(Router);

  readonly cop = cop;
  readonly km = km;
  readonly initials = initials;
  readonly acceptSeconds = ACCEPT_SECONDS;

  user = this.auth.user;
  online = appStorage.getItem('driver_online') === '1';
  approval: string = appStorage.getItem('driver_approval') ?? 'approved';
  toggling = false;

  requests: any[] = [];
  private ignored = new Set<number>();
  loadingRequests = false;
  accepting = false;

  earnings = this.driver.todayEarnings();
  error = '';
  info = '';
  menuOpen = false;

  // Contador del pedido actual
  remaining = ACCEPT_SECONDS;
  private currentId: number | null = null;
  private shownAt = 0;

  // Deslizador "Desliza para aceptar"
  slideX = 0;
  private dragging = false;
  private dragStartX = 0;
  private trackWidth = 0;

  private pollId: ReturnType<typeof setInterval> | null = null;
  private tickId: ReturnType<typeof setInterval> | null = null;
  private gpsId: ReturnType<typeof setInterval> | null = null;

  ionViewWillEnter(): void {
    this.user = this.auth.user;
    this.earnings = this.driver.todayEarnings();
    this.menuOpen = false;
    this.error = '';

    // Si hay un viaje en curso guardado, continuar con él
    const trip = this.driver.currentTrip;
    if (trip && trip.status !== 'completed' && trip.status !== 'cancelled') {
      this.router.navigateByUrl('/driver/trip', { replaceUrl: true });
      return;
    }
    if (this.online) this.startOnline();
    this.tickId = setInterval(() => this.tick(), 250);
  }

  ionViewWillLeave(): void {
    this.stopOnline();
    if (this.tickId) clearInterval(this.tickId);
    this.tickId = null;
  }

  get shortName(): string {
    const parts = (this.user?.name ?? '').trim().split(/\s+/);
    return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0] ?? '';
  }

  get approvalLabel(): string {
    return { approved: 'aprobado', pending: 'pendiente de aprobación', rejected: 'rechazado', suspended: 'suspendido' }[this.approval] ?? this.approval;
  }

  // ---------- Disponibilidad ----------

  toggleOnline(): void {
    const next = this.online ? 'unavailable' : 'available';
    this.toggling = true;
    this.error = '';
    this.driver.setAvailability(next).subscribe({
      next: () => {
        this.toggling = false;
        this.approval = 'approved';
        appStorage.setItem('driver_approval', 'approved');
        this.online = next === 'available';
        appStorage.setItem('driver_online', this.online ? '1' : '0');
        if (this.online) this.startOnline();
        else this.stopOnline();
      },
      error: (err) => {
        this.toggling = false;
        if (err.status === 403 && err.error?.approval_status) {
          this.approval = err.error.approval_status;
          appStorage.setItem('driver_approval', this.approval);
        }
        this.error = apiErrorMessage(err, 'No se pudo cambiar tu disponibilidad');
      },
    });
  }

  private startOnline(): void {
    this.stopOnline();
    this.loadRequests();
    this.pollId = setInterval(() => this.loadRequests(true), 7000);
    this.sendLocation();
    this.gpsId = setInterval(() => this.sendLocation(), 30000);
  }

  private stopOnline(): void {
    if (this.pollId) clearInterval(this.pollId);
    if (this.gpsId) clearInterval(this.gpsId);
    this.pollId = this.gpsId = null;
    this.requests = [];
  }

  private async sendLocation(): Promise<void> {
    try {
      const pos = await this.maps.currentPosition();
      this.driver.sendLocation({ latitude: pos.lat, longitude: pos.lng }).subscribe({ error: () => {} });
    } catch {
      /* sin GPS */
    }
  }

  // ---------- Solicitudes ----------

  private inFlight = false;

  loadRequests(silent = false): void {
    if (this.inFlight || this.accepting) return; // no encimar consultas si el servidor va lento
    this.inFlight = true;
    if (!silent) this.loadingRequests = true;
    this.driver.rideRequests().subscribe({
      next: (res) => {
        this.inFlight = false;
        this.loadingRequests = false;
        // Acepta distintas formas de respuesta: requests, ride_requests, data (paginado o no)
        const list: any[] = asList(res, 'requests', 'ride_requests', 'pending_requests', 'available_requests');
        this.requests = list;
      },
      error: (err) => {
        this.inFlight = false;
        this.loadingRequests = false;
        if (!silent) this.error = apiErrorMessage(err, 'No se pudieron cargar las solicitudes');
      },
    });
  }

  get visible(): any[] {
    return this.requests.filter((r) => !this.ignored.has(r.id));
  }

  get current(): any {
    return this.visible[0] ?? null;
  }

  private tick(): void {
    const cur = this.current;
    if (!cur) {
      this.currentId = null;
      return;
    }
    if (cur.id !== this.currentId) {
      this.currentId = cur.id;
      this.shownAt = Date.now();
      this.slideX = 0;
    }
    this.remaining = Math.max(0, ACCEPT_SECONDS - (Date.now() - this.shownAt) / 1000);
    if (this.remaining <= 0 && !this.accepting && !this.dragging) this.ignore();
  }

  ignore(): void {
    if (this.current) this.ignored.add(this.current.id);
    this.slideX = 0;
  }

  accept(): void {
    const req = this.current;
    if (!req || this.accepting) return;
    this.accepting = true;
    this.error = '';
    this.driver.accept(req.id).subscribe({
      next: (res) => {
        this.accepting = false;
        const t = res?.trip ?? res?.data ?? {};
        const trip: DriverTrip = {
          ...req,
          ...t,
          id: t.id ?? res?.trip_id,
          request_id: t.request_id ?? req.id,
          status: t.status ?? 'assigned',
          estimated_fare: t.estimated_fare ?? req.estimated_fare,
          client: req.client ?? t.client,
          accepted_at: new Date().toISOString(),
        };
        this.driver.saveTrip(trip);
        this.router.navigateByUrl('/driver/trip', { replaceUrl: true });
      },
      error: (err) => {
        this.accepting = false;
        this.slideX = 0;
        this.ignored.add(req.id);
        if (err.status === 409) this.info = 'Ese servicio ya lo tomó otro conductor.';
        else this.error = apiErrorMessage(err, 'No se pudo aceptar el servicio');
        this.loadRequests(true);
      },
    });
  }

  // ---------- Deslizar para aceptar ----------

  onDown(e: PointerEvent, track: HTMLElement): void {
    if (this.accepting) return;
    this.dragging = true;
    this.dragStartX = e.clientX - this.slideX;
    this.trackWidth = track.clientWidth - 52;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  onMove(e: PointerEvent): void {
    if (!this.dragging) return;
    this.slideX = Math.min(this.trackWidth, Math.max(0, e.clientX - this.dragStartX));
  }

  onUp(): void {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.slideX >= this.trackWidth * 0.85) {
      this.slideX = this.trackWidth;
      this.accept();
    } else {
      this.slideX = 0;
    }
  }

  logout(): void {
    this.stopOnline();
    const done = () => {
      appStorage.removeItem('driver_online');
      this.router.navigateByUrl('/login', { replaceUrl: true });
    };
    // Desconectarse antes de salir
    this.driver.setAvailability('unavailable').subscribe({ next: () => {}, error: () => {} });
    this.auth.logout().subscribe({
      next: done,
      error: () => {
        this.auth.clearSession();
        done();
      },
    });
  }
}
