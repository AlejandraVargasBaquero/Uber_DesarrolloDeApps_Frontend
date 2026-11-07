import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonSpinner, IonRefresher, IonRefresherContent, IonInfiniteScroll, IonInfiniteScrollContent } from '@ionic/angular';
import { ClientService } from '../../../core/services/client.service';
import { apiErrorMessage } from '../../../core/utils/api-error';
import { cop, km, statusLabel } from '../../../core/utils/format';

/** HU-12 · Historial de viajes */
@Component({
  selector: 'app-client-trips',
  templateUrl: './client-trips.page.html',
  styleUrls: ['./client-trips.page.scss'],
  imports: [DatePipe, IonContent, IonSpinner, IonRefresher, IonRefresherContent, IonInfiniteScroll, IonInfiniteScrollContent],
})
export class ClientTripsPage {
  private client = inject(ClientService);
  router = inject(Router);

  readonly cop = cop;
  readonly km = km;
  readonly statusLabel = statusLabel;

  trips: any[] = [];
  page = 1;
  lastPage = 1;
  loading = true;
  error = '';
  selected: any = null;

  ionViewWillEnter(): void {
    this.reload();
  }

  reload(event?: CustomEvent): void {
    this.page = 1;
    if (!event) this.loading = true;
    this.fetch(1, (list) => {
      this.trips = list;
      (event?.target as any)?.complete?.();
    });
  }

  more(event: CustomEvent): void {
    if (this.page >= this.lastPage) {
      (event.target as any).complete();
      return;
    }
    this.fetch(this.page + 1, (list) => {
      this.trips = [...this.trips, ...list];
      (event.target as any).complete();
    });
  }

  get hasMore(): boolean {
    return this.page < this.lastPage;
  }

  private fetch(page: number, done: (list: any[]) => void): void {
    this.error = '';
    this.client.trips(page).subscribe({
      next: (res) => {
        this.loading = false;
        const t = res?.trips;
        const list: any[] = Array.isArray(t) ? t : (t?.data ?? []);
        this.page = t?.current_page ?? page;
        this.lastPage = t?.last_page ?? page;
        done(list);
      },
      error: (err) => {
        this.loading = false;
        this.error = apiErrorMessage(err, 'No se pudo cargar el historial');
        done([]);
      },
    });
  }

  amount(t: any): number {
    return t.final_fare ?? t.estimated_fare ?? 0;
  }

  dateOf(t: any): string | null {
    return t.completed_at ?? t.started_at ?? t.created_at ?? null;
  }

  rate(t: any): void {
    this.selected = null;
    this.router.navigate(['/client/trips', t.id, 'rate']);
  }
}
