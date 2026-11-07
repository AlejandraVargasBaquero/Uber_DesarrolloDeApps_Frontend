import { Component, ElementRef, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../../core/services/auth.service';
import { ClientService, FareEstimate } from '../../../core/services/client.service';
import { DEFAULT_CENTER, LatLng, MapService, PlaceSuggestion } from '../../../core/services/map.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { cop, firstName, haversineKm, initials, km } from '../../../core/utils/format';
import { appStorage } from '../../../core/utils/storage';

interface Place extends LatLng {
  name: string;
}

/** Mockup 2 · Pedir viaje (HU-04, HU-05, HU-06) */
@Component({
  selector: 'app-client-home',
  templateUrl: './client-home.page.html',
  styleUrls: ['./client-home.page.scss'],
  imports: [FormsModule, IonContent, IonSpinner],
})
export class ClientHomePage {
  @ViewChild('mapEl') mapEl!: ElementRef<HTMLDivElement>;
  @ViewChild('destInput') destInput?: ElementRef<HTMLInputElement>;

  private auth = inject(AuthService);
  private client = inject(ClientService);
  private maps = inject(MapService);
  router = inject(Router);

  user = this.auth.user;
  readonly cop = cop;
  readonly km = km;
  readonly initials = initials;
  readonly firstName = firstName;

  origin: Place | null = null;
  destination: Place | null = null;

  // Búsqueda con teclado y sugerencias (tipo Google Maps)
  focused: 'origin' | 'destination' | null = null;
  originText = '';
  destText = '';
  suggestions: PlaceSuggestion[] = [];
  activeIndex = -1;
  searching = false;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private searchSeq = 0;

  estimate: FareEstimate | null = null;
  estimating = false;
  /** true mientras se muestra la tarifa calculada en el dispositivo y no ha llegado la de la API */
  preliminary = false;
  private fare: any = null;
  private estimateSeq = 0;
  requesting = false;
  locating = false;
  checking = true;
  menuOpen = false;

  error = '';
  notice = '';

  private map: any = null;
  private originMarker: any = null;
  private destMarker: any = null;
  private routeLine: any = null;

  ionViewWillEnter(): void {
    this.user = this.auth.user;
    this.error = '';
    this.notice = appStorage.getItem('client_notice') ?? '';
    appStorage.removeItem('client_notice');
    this.menuOpen = false;
    // Tarifa activa (pública) para mostrar un cálculo inmediato mientras responde la API
    if (!this.fare) {
      this.client.activeFare().subscribe({ next: (res) => (this.fare = res?.fare ?? null), error: () => {} });
    }
    // Si ya tiene un viaje o solicitud activa, ir directo al seguimiento
    this.checking = true;
    this.client.active().subscribe({
      next: (res) => {
        this.checking = false;
        if (res?.has_active) this.router.navigateByUrl('/client/trip', { replaceUrl: true });
      },
      error: () => (this.checking = false),
    });
  }

  ionViewDidEnter(): void {
    if (!this.map) {
      this.map = this.maps.createMap(this.mapEl.nativeElement, DEFAULT_CENTER, 15);
      if (this.map) {
        // Tocar el mapa solo cierra la búsqueda (las direcciones se eligen escribiendo)
        this.map.on('click', () => this.focused && this.closeSearch());
      }
      this.useMyLocation(true);
    } else {
      setTimeout(() => this.map.invalidateSize(), 50);
    }
  }

  // ---------- Ubicación de recogida (HU-04) ----------

  async useMyLocation(silent = false): Promise<void> {
    this.locating = true;
    try {
      const pos = await this.maps.currentPosition();
      await this.setOrigin({ ...pos, name: 'Mi ubicación' }, true);
    } catch {
      if (!silent) this.error = 'No se pudo obtener tu ubicación. Revisa los permisos del navegador.';
      if (!this.origin) {
        // Punto por defecto para poder usar la app sin GPS
        await this.setOrigin({ ...DEFAULT_CENTER, name: 'Parque de la 93, Calle 93A # 12-50' }, false);
      }
    } finally {
      this.locating = false;
    }
  }

  private async setOrigin(place: Place, reverse: boolean): Promise<void> {
    this.origin = place;
    if (this.map) {
      if (!this.originMarker) {
        this.originMarker = this.maps.marker(this.map, place, this.maps.originIcon());
      } else {
        this.originMarker.setLatLng([place.lat, place.lng]);
      }
      if (!this.destination) this.map.setView([place.lat, place.lng], 16);
    }
    if (reverse) {
      const name = await this.maps.reverse(place);
      if (this.origin === place) this.origin = { ...place, name };
    }
    this.refreshRoute();
  }

  private async setDestination(place: Place): Promise<void> {
    this.destination = place;
    if (this.map) {
      if (!this.destMarker) {
        this.destMarker = this.maps.marker(this.map, place, this.maps.destinationIcon());
      } else {
        this.destMarker.setLatLng([place.lat, place.lng]);
      }
    }
    this.refreshRoute();
  }

  // ---------- Búsqueda de direcciones (HU-05) ----------

  onFocus(target: 'origin' | 'destination', input: HTMLInputElement): void {
    this.focused = target;
    this.activeIndex = -1;
    this.suggestions = [];
    if (target === 'origin') this.originText = this.origin?.name === 'Mi ubicación' ? '' : (this.origin?.name ?? '');
    else this.destText = this.destination?.name ?? '';
    setTimeout(() => input.select(), 0);
  }

  closeSearch(): void {
    this.focused = null;
    this.suggestions = [];
    this.activeIndex = -1;
    this.searching = false;
    (document.activeElement as HTMLElement | null)?.blur?.();
  }

  onType(target: 'origin' | 'destination', value: string): void {
    if (target === 'origin') this.originText = value;
    else this.destText = value;
    this.activeIndex = -1;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (value.trim().length < 3) {
      this.suggestions = [];
      this.searching = false;
      return;
    }
    this.searching = true;
    const seq = ++this.searchSeq;
    this.searchTimer = setTimeout(async () => {
      const results = await this.maps.search(value, this.origin ?? DEFAULT_CENTER);
      if (seq !== this.searchSeq) return; // llegó una búsqueda más reciente
      this.suggestions = results;
      this.searching = false;
    }, 350);
  }

  /** Flechas para moverse, Enter para elegir, Esc para cerrar. */
  onKey(e: KeyboardEvent): void {
    const total = this.suggestions.length;
    if (e.key === 'ArrowDown' && total) {
      e.preventDefault();
      this.activeIndex = (this.activeIndex + 1) % total;
    } else if (e.key === 'ArrowUp' && total) {
      e.preventDefault();
      this.activeIndex = (this.activeIndex - 1 + total) % total;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const s = this.suggestions[this.activeIndex >= 0 ? this.activeIndex : 0];
      if (s) this.pick(s);
    } else if (e.key === 'Escape') {
      this.closeSearch();
    }
  }

  async pick(s: PlaceSuggestion): Promise<void> {
    const place: Place = { lat: s.lat, lng: s.lng, name: s.short };
    const target = this.focused;
    this.closeSearch();
    if (target === 'origin') {
      await this.setOrigin(place, false);
      // Siguiente paso natural: escribir el destino
      if (!this.destination) setTimeout(() => this.destInput?.nativeElement.focus(), 100);
    } else {
      await this.setDestination(place);
    }
  }

  async pickMyLocation(): Promise<void> {
    this.closeSearch();
    await this.useMyLocation();
  }

  // ---------- Ruta y tarifa ----------

  private async refreshRoute(): Promise<void> {
    if (!this.origin || !this.destination) return;
    this.estimateFare();
    if (!this.map) return;
    const points = await this.maps.route(this.origin, this.destination);
    if (this.routeLine) this.routeLine.remove();
    this.routeLine = this.maps.polyline(this.map, points);
    this.maps.fit(this.map, points, [40, 110], 300);
  }

  private estimateFare(): void {
    if (!this.origin || !this.destination) return;
    const o = this.origin;
    const d = this.destination;
    const seq = ++this.estimateSeq;
    this.error = '';

    // 1) Cálculo inmediato con la tarifa activa (misma fórmula de la API: Haversine)
    const local = this.localEstimate(o, d);
    if (local) {
      this.estimate = local;
      this.preliminary = true;
    }
    this.estimating = true;

    // 2) Valor oficial de la API
    this.client
      .estimateFare({
        origin_latitude: o.lat,
        origin_longitude: o.lng,
        destination_latitude: d.lat,
        destination_longitude: d.lng,
      })
      .subscribe({
        next: (res) => {
          if (seq !== this.estimateSeq) return; // cambió el destino mientras tanto
          this.estimating = false;
          this.preliminary = false;
          this.estimate = res.estimate;
        },
        error: (err) => {
          if (seq !== this.estimateSeq) return;
          this.estimating = false;
          if (!this.estimate) this.error = apiErrorMessage(err, 'No se pudo calcular la tarifa');
        },
      });
  }

  /** Estimación local: max(mínima, (base + km·precio_km + min·precio_min) × multiplicador). */
  private localEstimate(o: LatLng, d: LatLng): FareEstimate | null {
    const f = this.fare;
    if (!f) return null;
    const distance = +haversineKm(o.lat, o.lng, d.lat, d.lng).toFixed(2);
    const minutes = Math.max(1, Math.round((distance / 20) * 60));
    const surge = Number(f.surge_multiplier) || 1;
    const raw = (Number(f.base_fare) + distance * Number(f.price_per_km) + minutes * Number(f.price_per_minute)) * surge;
    return {
      distance_km: distance,
      duration_min: minutes,
      estimated_fare: Math.round(Math.max(Number(f.minimum_fare), raw)),
      currency: 'COP',
      fare_breakdown: {
        base_fare: Number(f.base_fare),
        price_per_km: Number(f.price_per_km),
        price_per_minute: Number(f.price_per_minute),
        minimum_fare: Number(f.minimum_fare),
        surge_multiplier: surge,
      },
    };
  }

  breakdown(): string {
    const b = this.estimate?.fare_breakdown;
    if (!b) return '';
    const n = (v: number) => Math.round(Number(v)).toLocaleString('es-CO');
    const surge = Number(b.surge_multiplier).toLocaleString('es-CO', { minimumFractionDigits: 1 });
    return `BASE ${n(b.base_fare)} · KM ${n(b.price_per_km)} · MIN ${n(b.price_per_minute)} · MÍN ${n(b.minimum_fare)} · ×${surge}`;
  }

  // ---------- Solicitar viaje (HU-06) ----------

  confirm(): void {
    if (!this.origin || !this.destination) {
      this.error = 'Escribe y elige el destino';
      return;
    }
    this.requesting = true;
    this.error = '';
    const payload = {
      origin_name: this.origin.name,
      origin_latitude: +this.origin.lat.toFixed(7),
      origin_longitude: +this.origin.lng.toFixed(7),
      destination_name: this.destination.name,
      destination_latitude: +this.destination.lat.toFixed(7),
      destination_longitude: +this.destination.lng.toFixed(7),
    };
    this.client.createRideRequest(payload).subscribe({
      next: (res) => {
        this.requesting = false;
        // Guardamos la solicitud para mostrar la ruta y calcular la llegada del conductor
        appStorage.setItem('client_request', JSON.stringify({ ...payload, ...(res?.ride_request ?? {}) }));
        this.router.navigateByUrl('/client/trip');
      },
      error: (err) => {
        this.requesting = false;
        if (err.status === 400) {
          this.router.navigateByUrl('/client/trip');
          return;
        }
        this.error = apiErrorMessage(err, 'No se pudo crear la solicitud');
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
