import { Component, inject } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
} from '@ionic/angular';
import { ClientService } from '../../../core/services/client.service';
import { apiErrorMessage } from '../../../core/utils/api-error';

@Component({
  selector: 'app-client-trips',
  templateUrl: './client-trips.page.html',
  styleUrls: ['./client-trips.page.scss'],
  imports: [
    DatePipe,
    DecimalPipe,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
  ],
})
export class ClientTripsPage {
  private client = inject(ClientService);
  router = inject(Router);

  trips: any[] = [];
  loading = true;
  error = '';

  ionViewWillEnter(): void {
    this.load();
  }

  load(event?: CustomEvent): void {
    if (!event) this.loading = true;
    this.error = '';
    this.client.trips().subscribe({
      next: (res) => {
        this.loading = false;
        // Respuesta paginada de Laravel: trips.data
        this.trips = res.trips?.data ?? res.trips ?? [];
        (event?.target as HTMLIonRefresherElement | undefined)?.complete();
      },
      error: (err) => {
        this.loading = false;
        this.error = apiErrorMessage(err, 'No se pudo cargar el historial');
        (event?.target as HTMLIonRefresherElement | undefined)?.complete();
      },
    });
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      completed: 'Finalizado',
      cancelled: 'Cancelado',
      in_progress: 'En curso',
      assigned: 'Asignado',
      driver_arrived: 'Conductor llegó',
    };
    return labels[status] ?? status;
  }

  rate(trip: any): void {
    this.router.navigate(['/client/trips', trip.id, 'rate']);
  }
}
