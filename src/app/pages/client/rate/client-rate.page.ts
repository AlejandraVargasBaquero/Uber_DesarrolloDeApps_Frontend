import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonSpinner, IonToggle } from '@ionic/angular';
import { ClientService } from '../../../core/services/client.service';
import { apiErrorMessage } from '../../../core/utils/api-error';

@Component({
  selector: 'app-client-rate',
  templateUrl: './client-rate.page.html',
  styleUrls: ['./client-rate.page.scss'],
  imports: [FormsModule, IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonSpinner, IonToggle],
})
export class ClientRatePage {
  private client = inject(ClientService);
  private router = inject(Router);
  private tripId = Number(inject(ActivatedRoute).snapshot.paramMap.get('id'));

  stars = [1, 2, 3, 4, 5];
  score = 0;
  comment = '';
  hasIncident = false;

  sending = false;
  error = '';
  success = '';

  setScore(n: number): void {
    this.score = n;
  }

  submit(): void {
    this.error = '';
    if (this.score < 1) {
      this.error = 'Selecciona de 1 a 5 estrellas';
      return;
    }
    this.sending = true;
    this.client
      .rate(this.tripId, { score: this.score, comment: this.comment || undefined, has_incident: this.hasIncident })
      .subscribe({
        next: (res) => {
          this.sending = false;
          this.success = res.message ?? '¡Gracias por calificar!';
          setTimeout(() => this.router.navigateByUrl('/client/trips', { replaceUrl: true }), 1500);
        },
        error: (err) => {
          this.sending = false;
          this.error = apiErrorMessage(err, 'No se pudo enviar la calificación');
        },
      });
  }
}
