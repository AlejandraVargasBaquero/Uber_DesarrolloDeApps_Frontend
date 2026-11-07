import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular';
import { AuthService, RegisterData } from '../../core/services/auth.service';
import { apiErrorMessage } from '../../core/utils/api-error';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  imports: [FormsModule, IonContent, IonSpinner],
})
export class RegisterPage {
  private auth = inject(AuthService);
  router = inject(Router);

  role: 'client' | 'driver' =
    inject(ActivatedRoute).snapshot.queryParamMap.get('role') === 'driver' ? 'driver' : 'client';

  // Datos personales
  name = '';
  email = '';
  phone = '';
  password = '';

  // Datos del conductor
  licenseNumber = '';
  plate = '';
  brand = '';
  model = '';
  year: number | null = null;
  capacity: number | null = 4;
  color = '';

  error = '';
  loading = false;

  submit(): void {
    this.error = '';

    if (!this.name || !this.email || !this.phone || !this.password) {
      this.error = 'Completa nombre, correo, teléfono y contraseña';
      return;
    }
    if (this.password.length < 8) {
      this.error = 'La contraseña debe tener al menos 8 caracteres';
      return;
    }

    const data: RegisterData = {
      name: this.name,
      email: this.email,
      phone: this.phone,
      password: this.password,
      role: this.role,
    };

    if (this.role === 'driver') {
      if (!this.licenseNumber || !this.plate || !this.brand || !this.model || !this.year || !this.capacity || !this.color) {
        this.error = 'Completa todos los datos de la licencia y el vehículo';
        return;
      }
      Object.assign(data, {
        license_number: this.licenseNumber,
        plate: this.plate.toUpperCase(),
        brand: this.brand,
        model: this.model,
        year: Number(this.year),
        capacity: Number(this.capacity),
        color: this.color,
      });
    }

    this.loading = true;
    this.auth.register(data).subscribe({
      next: (res) => {
        this.loading = false;
        this.router.navigateByUrl(this.auth.homeFor(res.user.role), { replaceUrl: true });
      },
      error: (err) => {
        this.loading = false;
        this.error = apiErrorMessage(err, 'No se pudo completar el registro');
      },
    });
  }
}
