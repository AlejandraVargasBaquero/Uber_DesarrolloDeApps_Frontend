/** $6.500 (pesos colombianos, sin decimales). */
export function cop(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return '$' + Math.round(n).toLocaleString('es-CO');
}

/** Iniciales: "Carlos Rodríguez" -> "CR". */
export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

export function firstName(name: string | null | undefined): string {
  return (name ?? '').trim().split(/\s+/)[0] ?? '';
}

/** Distancia en km entre dos coordenadas (fórmula de Haversine). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** 1.28 -> "1,28 km" */
export function km(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' km';
}

export const TRIP_STATUS_LABELS: Record<string, string> = {
  requested: 'Buscando conductor',
  pending: 'Buscando conductor',
  assigned: 'Conductor asignado',
  driver_arrived: 'Tu conductor llegó',
  in_progress: 'Viaje en curso',
  completed: 'Completado',
  cancelled: 'Cancelado',
  expired: 'Sin conductor',
};

export function statusLabel(status: string | null | undefined): string {
  return TRIP_STATUS_LABELS[status ?? ''] ?? status ?? '';
}
