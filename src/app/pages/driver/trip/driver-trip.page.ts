import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular';
import { DriverService, DriverTrip } from '../../../core/services/driver.service';
import { LatLng, MapService } from '../../../core/services/map.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { cop, firstName, haversineKm, initials, km } from '../../../core/utils/format';
import { appStorage } from '../../../core/utils/storage';

const STEPS = [
  { key: 'assigned', label: 'Asignado' },
  { key: 'driver_arrived', label: 'Llegó' },
  { key: 'in_progress', label: 'En curso' },
  { key: 'completed', label: 'Finalizado' },
];

/** Mockup 6 · Conductor · Viaje en curso (HU-09) */
@Component({
  selector: 'app-driver-trip',
  templateUrl: './driver-trip.page.html',
  styleUrls: ['./driver-trip.page.scss'],
  imports: [IonContent, IonSpinner],
})
export class DriverTripPage {
  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;

  private driver = inject(DriverService);
  private maps = inject(MapService);
  router = inject(Router);

  readonly cop = cop;
  readonly km = km;
  readonly initials = initials;
  readonly steps = STEPS;

  trip: DriverTrip | null = null;
  busy = false;
  error = '';
  now = Date.now();

  private map: any = null;
  private carMarker: any = null;
  private routeDrawn = false;

  private watchId: number | null = null;
  private sendId: ReturnType<typeof setInterval> | null = null;
  private tickId: ReturnType<typeof setInterval> | null = null;
  private lastPos: (LatLng & { heading?: number | null; speed?: number | null }) | null = null;
  private travelledKm = Number(appStorage.getItem('driver_trip_km') ?? 0);

  ionViewWillEnter(): void {
    this.trip = this.driver.currentTrip;
    this.error = '';
    if (!this.trip) return; // se muestra el aviso "No hay un viaje activo"
    this.startGps();
    this.tickId = setInterval(() => (this.now = Date.now()), 1000);
  }

  ionViewDidEnter(): void {
    if (!this.map && this.mapEl) {
      this.map = this.maps.createMap(this.mapEl.nativeElement);
    }
    this.drawMap();
  }

  ionViewWillLeave(): void {
    this.stopGps();
    if (this.tickId) clearInterval(this.tickId);
    this.tickId = null;
  }

  // ---------- Estado ----------

  get stepIndex(): number {
    return Math.max(0, STEPS.findIndex((s) => s.key === this.trip?.status));
  }

  get clientName(): string {
    return this.trip?.client?.name ?? 'el cliente';
  }

  get heading(): string {
    const n = firstName(this.trip?.client?.name) || 'el cliente';
    switch (this.trip?.status) {
      case 'assigned':
        return `Recoger a ${n} en`;
      case 'driver_arrived':
        return `${n} sube en`;
      case 'in_progress':
        return `Llevando a ${n} hacia`;
      default:
        return 'Viaje finalizado';
    }
  }

  get address(): string {
    const t = this.trip;
    if (!t) return '';
    return t.status === 'in_progress' || t.status === 'completed' ? (t.destination_name ?? '') : (t.origin_name ?? '');
  }

  get distanceText(): string {
    const t = this.trip;
    if (t?.status === 'completed' && t.distance_travelled_km != null) return km(t.distance_travelled_km);
    if (t?.status === 'in_progress' && this.travelledKm > 0.05) return km(this.travelledKm);
    return t?.estimated_distance_km != null ? km(t.estimated_distance_km) : '—';
  }

  get elapsedMin(): number {
    const start = this.trip?.started_at ? new Date(this.trip.started_at).getTime() : null;
    if (!start) return 0;
    return Math.max(0, (this.now - start) / 60000);
  }

  get timeText(): string {
    const t = this.trip;
    if (t?.status === 'completed' && t.duration_travelled_min != null) return `${t.duration_travelled_min} min`;
    if (t?.status === 'in_progress') return `${Math.floor(this.elapsedMin)} min`;
    return t?.estimated_duration_min != null ? `${t.estimated_duration_min} min` : '—';
  }

  get fareValue(): number {
    return this.trip?.final_fare ?? this.trip?.estimated_fare ?? 0;
  }

  // ---------- Acciones (HU-09) ----------

  next(): void {
    const t = this.trip;
    if (!t || this.busy) return;
    this.busy = true;
    this.error = '';

    if (t.status === 'assigned') {
      this.driver.arrive(t.id).subscribe({
        next: (res) => this.update({ status: 'driver_arrived', arrived_at: res?.trip?.driver_arrived_at ?? new Date().toISOString() }),
        error: (err) => this.fail(err, 'No se pudo registrar la llegada'),
      });
    } else if (t.status === 'driver_arrived') {
      this.driver.start(t.id).subscribe({
        next: (res) => {
          this.travelledKm = 0;
          appStorage.setItem('driver_trip_km', '0');
          this.update({ status: 'in_progress', started_at: res?.trip?.started_at ?? new Date().toISOString() });
        },
        error: (err) => this.fail(err, 'No se pudo iniciar el viaje'),
      });
    } else if (t.status === 'in_progress') {
      // Si el GPS no registró recorrido (ej. en computador), se usa la distancia estimada
      const distance = this.travelledKm > 0.05 ? this.travelledKm : Number(t.estimated_distance_km ?? 0.5);
      const duration = Math.max(1, Math.ceil(this.elapsedMin));
      this.driver.complete(t.id, +distance.toFixed(2), duration).subscribe({
        next: (res) => {
          const r = res?.trip ?? {};
          const finalFare = Number(r.final_fare ?? t.estimated_fare);
          this.driver.addEarning(finalFare);
          appStorage.removeItem('driver_trip_km');
          this.update({
            status: 'completed',
            final_fare: finalFare,
            distance_travelled_km: r.distance_travelled_km ?? +distance.toFixed(2),
            duration_travelled_min: r.duration_travelled_min ?? duration,
            completed_at: r.completed_at ?? new Date().toISOString(),
          });
          this.stopGps();
        },
        error: (err) => this.fail(err, 'No se pudo finalizar el viaje'),
      });
    } else {
      this.done();
    }
  }

  get actionLabel(): string {
    switch (this.trip?.status) {
      case 'assigned':
        return 'Llegué al punto de recogida';
      case 'driver_arrived':
        return 'Iniciar viaje';
      case 'in_progress':
        return 'Finalizar viaje';
      default:
        return 'Volver a solicitudes';
    }
  }

  done(): void {
    this.driver.saveTrip(null);
    this.router.navigateByUrl('/driver', { replaceUrl: true });
  }

  call(): void {
    const phone = this.trip?.client?.phone;
    if (phone) window.location.href = `tel:${phone}`;
  }

  private update(patch: Partial<DriverTrip>): void {
    this.busy = false;
    this.trip = { ...(this.trip as DriverTrip), ...patch };
    this.driver.saveTrip(this.trip);
    this.drawMap();
  }

  private fail(err: any, fallback: string): void {
    this.busy = false;
    this.error = apiErrorMessage(err, fallback);
  }

  // ---------- GPS y mapa ----------

  private startGps(): void {
    if (navigator.geolocation && this.watchId === null) {
      this.watchId = navigator.geolocation.watchPosition(
        (p) => {
          const pos = { lat: p.coords.latitude, lng: p.coords.longitude, heading: p.coords.heading, speed: p.coords.speed };
          if (this.lastPos && this.trip?.status === 'in_progress') {
            const d = haversineKm(this.lastPos.lat, this.lastPos.lng, pos.lat, pos.lng);
            // Ignorar saltos irreales del GPS
            if (d > 0.005 && d < 1) {
              this.travelledKm += d;
              appStorage.setItem('driver_trip_km', String(this.travelledKm));
            }
          }
          this.lastPos = pos;
          this.moveCar();
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000 },
      );
    }
    // POST /driver/location cada 10 s mientras hay viaje
    this.sendId = setInterval(() => this.sendLocation(), 15000);
    this.sendLocation();
  }

  private stopGps(): void {
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId);
    if (this.sendId) clearInterval(this.sendId);
    this.watchId = null;
    this.sendId = null;
  }

  private sendLocation(): void {
    if (!this.lastPos || !this.trip || this.trip.status === 'completed') return;
    const speedKmh = this.lastPos.speed != null ? this.lastPos.speed * 3.6 : null;
    this.driver
      .sendLocation({ latitude: this.lastPos.lat, longitude: this.lastPos.lng, heading: this.lastPos.heading, speed: speedKmh, trip_id: this.trip.id })
      .subscribe({ error: () => {} });
  }

  private point(prefix: 'origin' | 'destination'): LatLng | null {
    const lat = Number((this.trip as any)?.[`${prefix}_latitude`]);
    const lng = Number((this.trip as any)?.[`${prefix}_longitude`]);
    return isFinite(lat) && isFinite(lng) && lat && lng ? { lat, lng } : null;
  }

  private moveCar(): void {
    if (!this.map || !this.lastPos) return;
    if (!this.carMarker) this.carMarker = this.maps.marker(this.map, this.lastPos, this.maps.carIcon());
    else this.carMarker.setLatLng([this.lastPos.lat, this.lastPos.lng]);
    if (!this.point('origin')) this.map.setView([this.lastPos.lat, this.lastPos.lng], 16);
  }

  private async drawMap(): Promise<void> {
    if (!this.map) return;
    this.map.invalidateSize();
    const o = this.point('origin');
    const d = this.point('destination');
    if (o && d && !this.routeDrawn) {
      this.routeDrawn = true;
      this.maps.marker(this.map, o, this.maps.originIcon());
      this.maps.marker(this.map, d, this.maps.destinationIcon());
      const pts = await this.maps.route(o, d);
      this.maps.polyline(this.map, pts);
    }
    const focus: [number, number][] = [];
    if (this.lastPos) focus.push([this.lastPos.lat, this.lastPos.lng]);
    const target = this.trip?.status === 'in_progress' || this.trip?.status === 'completed' ? d : o;
    if (target) focus.push([target.lat, target.lng]);
    if (o && d && focus.length < 2) {
      focus.push([o.lat, o.lng], [d.lat, d.lng]);
    }
    this.maps.fit(this.map, focus, [30, 30]);
    this.moveCar();
  }
}
