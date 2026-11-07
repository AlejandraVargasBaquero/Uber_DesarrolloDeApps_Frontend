import { Injectable } from '@angular/core';

/** Leaflet se carga por CDN en index.html */
declare const L: any;

export interface LatLng {
  lat: number;
  lng: number;
}

export interface PlaceSuggestion {
  name: string;
  short: string;
  lat: number;
  lng: number;
}

/** Centro por defecto: Bogotá (zona de los datos de prueba de la API). */
export const DEFAULT_CENTER: LatLng = { lat: 4.6766, lng: -74.0483 };

/**
 * Utilidades de mapa (Leaflet + OpenStreetMap).
 * Geocodificación: Nominatim. Rutas: OSRM (servicio público).
 * Son servicios externos gratuitos, no tocan el backend.
 */
@Injectable({ providedIn: 'root' })
export class MapService {
  get available(): boolean {
    return typeof L !== 'undefined';
  }

  createMap(el: HTMLElement, center: LatLng = DEFAULT_CENTER, zoom = 15): any {
    if (!this.available) return null;
    const map = L.map(el, { zoomControl: false, attributionControl: true }).setView([center.lat, center.lng], zoom);
    // Mapa libre de OpenStreetMap (sin clave); el tema oscuro se aplica con CSS (.ride-tiles)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      className: 'ride-tiles',
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);
    // Ionic monta la vista con animación: recalcular tamaño cuando ya es visible
    setTimeout(() => map.invalidateSize(), 300);
    return map;
  }

  /** Marcador de origen: círculo con borde verde. */
  originIcon(): any {
    return L.divIcon({ className: 'ride-pin ride-pin-origin', iconSize: [22, 22], iconAnchor: [11, 11] });
  }

  /** Marcador de destino: cuadrado verde. */
  destinationIcon(): any {
    return L.divIcon({ className: 'ride-pin ride-pin-dest', iconSize: [18, 18], iconAnchor: [9, 9] });
  }

  /** Marcador del carro del conductor. */
  carIcon(): any {
    return L.divIcon({ className: 'ride-pin ride-pin-car', html: '<span>🚗</span>', iconSize: [34, 34], iconAnchor: [17, 17] });
  }

  marker(map: any, pos: LatLng, icon: any, draggable = false): any {
    return L.marker([pos.lat, pos.lng], { icon, draggable }).addTo(map);
  }

  polyline(map: any, points: [number, number][]): any {
    return L.polyline(points, { color: '#2ee28a', weight: 5, opacity: 0.95, lineJoin: 'round' }).addTo(map);
  }

  fit(map: any, points: [number, number][], padding: [number, number] = [40, 40], paddingBottom = 0): void {
    if (!map || !points.length) return;
    if (points.length === 1) {
      map.setView(points[0], 16);
      return;
    }
    map.fitBounds(L.latLngBounds(points), {
      paddingTopLeft: padding,
      paddingBottomRight: [padding[0], padding[1] + paddingBottom],
    });
  }

  /** Ruta por calles (OSRM). Si falla, devuelve una línea recta. */
  async route(a: LatLng, b: LatLng): Promise<[number, number][]> {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();
      const coords: [number, number][] = data?.routes?.[0]?.geometry?.coordinates ?? [];
      if (coords.length) return coords.map(([lng, lat]) => [lat, lng]);
    } catch {
      /* sin conexión al servicio de rutas */
    }
    return [
      [a.lat, a.lng],
      [b.lat, b.lng],
    ];
  }

  /** Ciudad detectada en la última geocodificación inversa (para mejorar la búsqueda). */
  city = '';

  /**
   * Buscar direcciones con sugerencias mientras se escribe (tipo Google Maps).
   * 1) Photon (autocompletado, prioriza lugares cercanos)  2) Nominatim (direcciones con #)
   */
  async search(query: string, near?: LatLng): Promise<PlaceSuggestion[]> {
    const q = query.trim();
    if (q.length < 3) return [];
    const [a, b] = await Promise.all([this.searchPhoton(q, near), this.searchNominatim(q, near)]);
    // Unir resultados sin duplicados (por cercanía de coordenadas)
    const out: PlaceSuggestion[] = [];
    for (const s of [...a, ...b]) {
      if (!out.some((o) => Math.abs(o.lat - s.lat) < 0.0005 && Math.abs(o.lng - s.lng) < 0.0005)) out.push(s);
    }
    if (near) {
      out.sort((x, y) => this.dist(near, x) - this.dist(near, y));
    }
    return out.slice(0, 7);
  }

  private dist(a: LatLng, b: LatLng): number {
    return Math.hypot(a.lat - b.lat, a.lng - b.lng);
  }

  /** "Calle 5 # 10-20" -> "Calle 5 10-20" (formato que entienden los geocodificadores). */
  private normalize(q: string): string {
    return q
      .replace(/#|n[°º]\.?|no\./gi, ' ')
      .replace(/\bcl\b\.?/gi, 'Calle')
      .replace(/\bcra\b\.?|\bkr\b\.?|\bcr\b\.?/gi, 'Carrera')
      .replace(/\bav\b\.?/gi, 'Avenida')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private async searchPhoton(q: string, near?: LatLng): Promise<PlaceSuggestion[]> {
    const params = new URLSearchParams({ q: this.normalize(q), limit: '8' });
    if (near) {
      params.set('lat', String(near.lat));
      params.set('lon', String(near.lng));
      params.set('location_bias_scale', '0.3');
    }
    try {
      const res = await fetch(`https://photon.komoot.io/api/?${params}`);
      const data = await res.json();
      return (data?.features ?? [])
        .filter((f: any) => !f.properties?.countrycode || f.properties.countrycode === 'CO')
        .map((f: any) => {
          const p = f.properties ?? {};
          const street = [p.street, p.housenumber].filter(Boolean).join(' # ');
          const title = p.name && p.name !== p.street ? p.name : street || p.name || q;
          const detail = [p.name && p.name !== p.street ? street : '', p.district, p.city ?? p.county, p.state]
            .filter(Boolean)
            .join(', ');
          return {
            short: title,
            name: detail || title,
            lat: Number(f.geometry.coordinates[1]),
            lng: Number(f.geometry.coordinates[0]),
          } as PlaceSuggestion;
        });
    } catch {
      return [];
    }
  }

  private async searchNominatim(q: string, near?: LatLng): Promise<PlaceSuggestion[]> {
    let text = this.normalize(q);
    if (this.city && !text.toLowerCase().includes(this.city.toLowerCase())) text += `, ${this.city}`;
    const params = new URLSearchParams({
      format: 'json',
      q: text,
      countrycodes: 'co',
      limit: '5',
      'accept-language': 'es',
    });
    if (near) {
      const d = 0.3;
      params.set('viewbox', `${near.lng - d},${near.lat + d},${near.lng + d},${near.lat - d}`);
    }
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`);
      const data: any[] = await res.json();
      return data.map((p) => {
        const parts = String(p.display_name).split(',').map((x: string) => x.trim());
        return {
          short: parts.slice(0, 2).join(', '),
          name: parts.slice(2, 5).join(', '),
          lat: Number(p.lat),
          lng: Number(p.lon),
        };
      });
    } catch {
      return [];
    }
  }

  /** Dirección aproximada de una coordenada. */
  async reverse(pos: LatLng): Promise<string> {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.lat}&lon=${pos.lng}&zoom=18&accept-language=es`,
      );
      const data = await res.json();
      const a = data?.address ?? {};
      this.city = a.city || a.town || a.village || a.municipality || this.city;
      const street = [a.road, a.house_number].filter(Boolean).join(' # ');
      const zone = a.neighbourhood || a.suburb || a.city_district || '';
      return [street, zone].filter(Boolean).join(', ') || String(data?.display_name ?? '').split(',').slice(0, 2).join(',');
    } catch {
      return `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
    }
  }

  /** Ubicación actual del dispositivo. */
  currentPosition(): Promise<LatLng> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalización no disponible'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        (e) => reject(e),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    });
  }
}
