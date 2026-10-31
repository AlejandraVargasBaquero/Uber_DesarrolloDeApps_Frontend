import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons } from '@ionic/angular';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonButtons],
})
export class HomePage {
  private auth = inject(AuthService);
  private router = inject(Router);

  user = this.auth.user;

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigateByUrl('/login', { replaceUrl: true }),
      // Aunque la API falle, cerramos la sesión localmente
      error: () => {
        this.auth.clearSession();
        this.router.navigateByUrl('/login', { replaceUrl: true });
      },
    });
  }
}
