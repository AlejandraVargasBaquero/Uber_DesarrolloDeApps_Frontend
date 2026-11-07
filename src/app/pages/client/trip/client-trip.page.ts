import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular';
import { ClientService } from '../../../core/services/client.service';
import { LatLng, MapService } from '../../../core/services/map.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { cop, firstName, haversineKm, initials, km } from '../../../core/utils/format';
import { appStorage } from '../../../core/utils/storage';

const SEARCH_LIMIT_SECONDS = 180; // HU-06: aviso si nadie acepta en 3 minutos
const CANCEL_REASONS = [
  'Cambio de planes',
  'El conductor tarda demasiado',
  'Pedí el viaje por error',
  'Encontré otro transporte',
];

/** Mockup 3 · Viaje activo (HU-06, HU-08, HU-13, HU-14) */
@Component({
  selector: 'app-client-trip',
  templateUrl: './client-trip.page.html',
  styleUrls: ['./client-trip.page.scss'],
  imports: [FormsModule, IonContent, IonSpinner],
})
export class ClientTripPage {
  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;

  private client = inject(ClientService);
  private maps = inject(MapService);
  router = inject(Router);

  readonly cop = cop;
  readonly km = km;
  readonly initials = initials;
  readonly firstName = firstName;
  readonly reasons = CANCEL_REASONS;

  data: any = null;
  type: 'request' | 'trip' | null = null;
  loading = true;
  error = '';

  /** Solicitud guardada al pedir el viaje (nombres y coordenadas). */
  request: any = this.readRequest();

  elapsed = 0;
  private searchStartedAt = Date.now();

  // Cancelación
  cancelOpen = false;
  cancelReason = CANCEL_REASONS[0];
  cancelling = false;

  // SOS
  sosOpen = false;
  trustedPhone = appStorage.getItem('trusted_contact') ?? '';
  sosMessage = '';

  private pollId: ReturnType<typeof setInterval> | null = null;
  private tickId: ReturnType<typeof setInterval> | null = null;
  private lastTrip: any = null;

  private map: any = null;
  private carMarker: any = null;
  private originMarker: any = null;
  private destMarker: any = null;
  private routeLine: any = null;
  private routeDrawn = false;

  ionViewWillEnter(): void {
    this.request = this.readRequest();
    this.searchStartedAt = this.request?.created_at ? new Date(this.request.created_at).getTime() : Date.now();
    this.load();
    // HU-08: actualización periódica (la API no tiene sockets)
    this.pollId = setInterval(() => this.load(true), 7000);
    this.tickId = setInterval(() => (this.elapsed = Math.max(0, Math.floor((Date.now() - this.searchStartedAt) / 1000))), 1000);
  }

  ionViewDidEnter(): void {
    if (!this.map && this.mapEl) {
      this.map = this.maps.createMap(this.mapEl.nativeElement);
      this.drawMap();
    }
  }

  ionViewWillLeave(): void {
    if (this.pollId) clearInterval(this.pollId);
    if (this.tickId) clearInterval(this.tickId);
    this.pollId = this.tickId = null;
  }

  private readRequest(): any {
    try {
      return JSON.parse(appStorage.getItem('client_request') ?? 'null');
    } catch {
      return null;
    }
  }

  private inFlight = false;

  load(silent = false): void {
    if (this.inFlight) return; // no encimar consultas si el servidor va lento
    this.inFlight = true;
    if (!silent) this.loading = true;
    this.client.active().subscribe({
      next: (res) => {
        this.inFlight = false;
        this.loading = false;
        this.error = '';
        if (!res?.has_active) {
          this.finished();
          return;
        }
        this.type = res.type;
        this.data = res.data;
        if (this.type === 'trip') {
          this.lastTrip = res.data;
          appStorage.setItem('client_last_trip', JSON.stringify({ ...this.request, ...res.data }));
        }
        this.drawMap();
      },
      error: (err) => {
        this.inFlight = false;
        this.loading = false;
        if (!silent || !this.data) this.error = apiErrorMessage(err, 'No se pudo consultar tu viaje');
      },
    });
  }

  /** Ya no hay viaje activo: se consulta el historial para saber si terminó o se canceló. */
  private finished(): void {
    this.ionViewWillLeave();
    const trip = this.lastTrip;
    appStorage.removeItem('client_request');

    if (!trip?.id) {
      // Era solo una solicitud (nadie la aceptó): se canceló o venció
      this.leave('Tu solicitud ya no está activa. Puedes pedir otro viaje.');
      return;
    }
    this.client.trips().subscribe({
      next: (res) => {
        const t = res?.trips;
        const list: any[] = Array.isArray(t) ? t : (t?.data ?? []);
        const found = list.find((x) => Number(x.id) === Number(trip.id));
        if (found?.status === 'completed') {
          appStorage.setItem('client_last_trip', JSON.stringify({ ...trip, ...found }));
          this.router.navigate(['/client/trips', trip.id, 'rate'], { replaceUrl: true });
        } else if (found?.status === 'cancelled') {
          this.leave('El viaje fue cancelado.');
        } else {
          this.leave('Tu viaje ya no está activo.');
        }
      },
      error: () => this.leave('Tu viaje ya no está activo.'),
    });
  }

  private leave(message: string): void {
    appStorage.setItem('client_notice', message);
    this.router.navigateByUrl('/client', { replaceUrl: true });
  }

  // ---------- Datos para la vista ----------

  get status(): string {
    return this.data?.status ?? 'requested';
  }

  /** Hay una solicitud recién creada guardada: se puede mostrar sin esperar al servidor. */
  get hasLocalRequest(): boolean {
    return !!this.request;
  }

  get searchingDriver(): boolean {
    return this.type === 'request' || this.status === 'requested' || this.status === 'pending';
  }

  get driver(): any {
    return this.data?.driver ?? null;
  }

  get vehicle(): any {
    return this.data?.vehicle ?? null;
  }

  get originName(): string {
    return this.data?.origin_name ?? this.request?.origin_name ?? '';
  }

  get destinationName(): string {
    return this.data?.destination_name ?? this.request?.destination_name ?? '';
  }

  get fare(): number {
    return this.data?.estimated_fare ?? this.request?.estimated_fare ?? 0;
  }

  private point(prefix: 'origin' | 'destination'): LatLng | null {
    const lat = Number(this.data?.[`${prefix}_latitude`] ?? this.request?.[`${prefix}_latitude`]);
    const lng = Number(this.data?.[`${prefix}_longitude`] ?? this.request?.[`${prefix}_longitude`]);
    return isFinite(lat) && isFinite(lng) && lat && lng ? { lat, lng } : null;
  }

  private get driverPos(): LatLng | null {
    const loc = this.driver?.latest_location;
    if (!loc) return null;
    const lat = Number(loc.latitude);
    const lng = Number(loc.longitude);
    return isFinite(lat) && isFinite(lng) ? { lat, lng } : null;
  }

  /** Minutos estimados (velocidad urbana promedio ~22 km/h). */
  get etaMin(): number | null {
    const target = this.status === 'in_progress' ? this.point('destination') : this.point('origin');
    const from = this.driverPos;
    if (!target || !from) return null;
    const d = haversineKm(from.lat, from.lng, target.lat, target.lng) * 1.3;
    return Math.max(1, Math.round((d / 22) * 60));
  }

  get headline(): { label: string; big: string; unit: string; sub: string } {
    const name = firstName(this.driver?.user?.name) || 'Tu conductor';
    const eta = this.etaMin;
    switch (this.status) {
      case 'assigned':
        return {
          label: 'Conductor asignado',
          big: eta !== null ? String(eta) : '—',
          unit: 'min',
          sub: `${name} va hacia ${this.short(this.originName) || 'tu punto de recogida'}`,
        };
      case 'driver_arrived':
        return { label: 'Tu conductor llegó', big: 'Ya', unit: 'está aquí', sub: `${name} te espera en ${this.short(this.originName) || 'el punto de recogida'}` };
      case 'in_progress':
        return {
          label: 'Viaje en curso',
          big: eta !== null ? String(eta) : '—',
          unit: 'min',
          sub: `Llegando a ${this.short(this.destinationName) || 'tu destino'}`,
        };
      default:
        return { label: 'Buscando conductor', big: this.clock(this.elapsed), unit: '', sub: 'Estamos buscando un conductor cercano' };
    }
  }

  get searchTimedOut(): boolean {
    return this.searchingDriver && this.elapsed >= SEARCH_LIMIT_SECONDS;
  }

  get canCancel(): boolean {
    return ['requested', 'pending', 'assigned', 'driver_arrived'].includes(this.status);
  }

  private short(name: string): string {
    return (name ?? '').split(',')[0];
  }

  clock(s: number): string {
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, '0')}`;
  }

  // ---------- Mapa (HU-08) ----------

  private async drawMap(): Promise<void> {
    if (!this.map) return;
    this.map.invalidateSize();
    const o = this.point('origin');
    const d = this.point('destination');
    const car = this.driverPos;

    if (o) {
      if (!this.originMarker) this.originMarker = this.maps.marker(this.map, o, this.maps.originIcon());
    }
    if (d) {
      if (!this.destMarker) this.destMarker = this.maps.marker(this.map, d, this.maps.destinationIcon());
    }
    if (car) {
      if (!this.carMarker) this.carMarker = this.maps.marker(this.map, car, this.maps.carIcon());
      else this.carMarker.setLatLng([car.lat, car.lng]);
    } else if (this.carMarker) {
      this.carMarker.remove();
      this.carMarker = null;
    }

    if (o && d && !this.routeDrawn) {
      this.routeDrawn = true;
      const pts = await this.maps.route(o, d);
      this.routeLine = this.maps.polyline(this.map, pts);
    }

    const focus: [number, number][] = [];
    if (car) focus.push([car.lat, car.lng]);
    const target = this.status === 'in_progress' ? d : o;
    if (target) focus.push([target.lat, target.lng]);
    if (!focus.length && o) focus.push([o.lat, o.lng]);
    this.maps.fit(this.map, focus, [30, 30]);
  }

  // ---------- Acciones ----------

  call(): void {
    const phone = this.driver?.user?.phone;
    if (phone) window.location.href = `tel:${phone}`;
  }

  confirmCancel(): void {
    if (!this.data?.id) return;
    this.cancelling = true;
    this.client.cancel(this.data.id, this.cancelReason).subscribe({
      next: () => {
        this.cancelling = false;
        this.cancelOpen = false;
        this.lastTrip = null;
        appStorage.removeItem('client_request');
        this.ionViewWillLeave();
        this.router.navigateByUrl('/client', { replaceUrl: true });
      },
      error: (err) => {
        this.cancelling = false;
        this.error = apiErrorMessage(err, 'No se pudo cancelar');
        this.cancelOpen = false;
      },
    });
  }

  // ---------- SOS (HU-14) ----------

  callEmergency(): void {
    window.location.href = 'tel:123';
  }

  async shareLocation(): Promise<void> {
    const phone = this.trustedPhone.replace(/\D/g, '');
    if (phone.length < 7) {
      this.sosMessage = 'Escribe el número de tu contacto de confianza';
      return;
    }
    appStorage.setItem('trusted_contact', this.trustedPhone);
    let pos = this.driverPos;
    try {
      pos = await this.maps.currentPosition();
    } catch {
      /* se usa la ubicación del conductor */
    }
    const where = pos ? `https://maps.google.com/?q=${pos.lat},${pos.lng}` : 'ubicación no disponible';
    const plate = this.vehicle?.plate ? ` Vehículo placa ${this.vehicle.plate}.` : '';
    const text = `🚨 Necesito ayuda. Estoy en un viaje de RideApp.${plate} Mi ubicación: ${where}`;
    const intl = phone.length === 10 ? `57${phone}` : phone;
    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(text)}`, '_blank');
    this.sosMessage = 'Se abrió WhatsApp con tu ubicación para enviarla.';
  }
}
