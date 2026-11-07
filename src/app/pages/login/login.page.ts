import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';
import { apiErrorMessage } from '../../core/utils/api-error';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  imports: [FormsModule, IonContent, IonSpinner],
})
export class LoginPage {
  private auth = inject(AuthService);
  router = inject(Router);

  login = '';
  password = '';
  error = '';
  loading = false;

  ionViewWillEnter(): void {
    const user = this.auth.user;
    if (this.auth.isLoggedIn() && user) {
      this.router.navigateByUrl(this.auth.homeFor(user.role), { replaceUrl: true });
    }
  }

  goRegister(role: 'client' | 'driver'): void {
    this.router.navigate(['/register'], { queryParams: { role } });
  }

  submit(): void {
    this.error = '';
    if (!this.login || !this.password) {
      this.error = 'Ingresa tu correo/teléfono y contraseña';
      return;
    }

    this.loading = true;
    this.auth.login(this.login, this.password).subscribe({
      next: (res) => {
        this.loading = false;
        this.password = '';
        this.router.navigateByUrl(this.auth.homeFor(res.user.role), { replaceUrl: true });
      },
      error: (err) => {
        this.loading = false;
        this.error = apiErrorMessage(err, 'Credenciales incorrectas');
      },
    });
  }
}
