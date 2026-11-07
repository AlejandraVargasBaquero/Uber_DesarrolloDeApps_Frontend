import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonSpinner, IonToggle } from '@ionic/angular';
import { ClientService } from '../../../core/services/client.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { cop, firstName, initials } from '../../../core/utils/format';
import { appStorage } from '../../../core/utils/storage';

/** Mockup 4 · Calificar (HU-11) */
@Component({
  selector: 'app-client-rate',
  templateUrl: './client-rate.page.html',
  styleUrls: ['./client-rate.page.scss'],
  imports: [FormsModule, IonContent, IonSpinner, IonToggle],
})
export class ClientRatePage {
  private client = inject(ClientService);
  private router = inject(Router);
  private tripId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  readonly cop = cop;
  readonly initials = initials;
  readonly tags = ['Puntual', 'Vehículo limpio', 'Buena ruta', 'Amable', 'Conducción segura'];

  trip: any = null;
  stars = [1, 2, 3, 4, 5];
  score = 0;
  selectedTags = new Set<string>();
  comment = '';
  hasIncident = false;

  sending = false;
  error = '';
  success = '';

  ionViewWillEnter(): void {
    this.trip = this.fromStorage();
    // Completar datos con el historial (tarifa final, distancia, etc.)
    this.client.trips().subscribe({
      next: (res) => {
        const list: any[] = res?.trips?.data ?? res?.trips ?? [];
        const found = list.find((t) => Number(t.id) === this.tripId);
        if (found) this.trip = { ...(this.trip ?? {}), ...found };
        if (found && found.status !== 'completed') {
          this.error = 'Este viaje no se finalizó, así que no se puede calificar.';
        }
      },
      error: () => {
        /* se muestran los datos guardados */
      },
    });
  }

  private fromStorage(): any {
    try {
      const t = JSON.parse(appStorage.getItem('client_last_trip') ?? 'null');
      return t && Number(t.id) === this.tripId ? t : null;
    } catch {
      return null;
    }
  }

  get driverName(): string {
    return this.trip?.driver?.user?.name ?? '';
  }

  get title(): string {
    const n = firstName(this.driverName);
    return n ? `¿Qué tal ${n}?` : '¿Qué tal tu viaje?';
  }

  get details(): string {
    const parts: string[] = [];
    const d = this.trip?.distance_travelled_km ?? this.trip?.estimated_distance_km;
    const m = this.trip?.duration_travelled_min ?? this.trip?.estimated_duration_min;
    if (d) parts.push(`${Number(d).toLocaleString('es-CO', { maximumFractionDigits: 2 })} KM`);
    if (m) parts.push(`${m} MIN`);
    if (this.trip?.vehicle?.plate) parts.push(this.trip.vehicle.plate);
    return parts.join(' · ');
  }

  get fare(): number | null {
    return this.trip?.final_fare ?? this.trip?.estimated_fare ?? null;
  }

  toggleTag(t: string): void {
    if (this.selectedTags.has(t)) this.selectedTags.delete(t);
    else this.selectedTags.add(t);
  }

  submit(): void {
    this.error = '';
    if (this.score < 1) {
      this.error = 'Toca las estrellas para calificar de 1 a 5';
      return;
    }
    const tags = [...this.selectedTags];
    const comment = [tags.length ? `[${tags.join(', ')}]` : '', this.comment.trim()].filter(Boolean).join(' ');

    this.sending = true;
    this.client.rate(this.tripId, { score: this.score, comment: comment || undefined, has_incident: this.hasIncident }).subscribe({
      next: (res) => {
        this.sending = false;
        this.success = res?.message ?? '¡Gracias por calificar!';
        appStorage.removeItem('client_last_trip');
        setTimeout(() => this.router.navigateByUrl('/client', { replaceUrl: true }), 1400);
      },
      error: (err) => {
        this.sending = false;
        this.error = apiErrorMessage(err, 'No se pudo enviar la calificación');
      },
    });
  }

  skip(): void {
    this.router.navigateByUrl('/client', { replaceUrl: true });
  }
}
