import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonList,
  IonItem,
  IonInput,
  IonButton,
  IonText,
  IonSpinner,
} from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';
import { apiErrorMessage } from '../../core/utils/api-error';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.page.html',
  styleUrls: ['./forgot-password.page.scss'],
  imports: [
    FormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonList,
    IonItem,
    IonInput,
    IonButton,
    IonText,
    IonSpinner,
  ],
})
export class ForgotPasswordPage {
  private auth = inject(AuthService);
  router = inject(Router);

  email = '';
  newPassword = '';
  confirmPassword = '';

  error = '';
  success = '';
  loading = false;

  submit(): void {
    this.error = '';
    this.success = '';

    if (!this.email || !this.newPassword) {
      this.error = 'Ingresa tu correo y la nueva contraseña';
      return;
    }
    if (this.newPassword.length < 8) {
      this.error = 'La contraseña debe tener al menos 8 caracteres';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Las contraseñas no coinciden';
      return;
    }

    this.loading = true;
    this.auth.forgotPassword(this.email, this.newPassword).subscribe({
      next: (res) => {
        this.loading = false;
        this.success = res.message ?? 'Contraseña restablecida';
        this.newPassword = '';
        this.confirmPassword = '';
      },
      error: (err) => {
        this.loading = false;
        this.error = apiErrorMessage(err, 'No se pudo restablecer la contraseña');
      },
    });
  }
}
