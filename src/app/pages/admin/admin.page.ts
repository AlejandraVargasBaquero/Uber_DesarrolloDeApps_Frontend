import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent, IonSpinner } from '@ionic/angular';
import { AuthService } from '../../core/services/auth.service';
import { AdminService, FareData, asList } from '../../core/services/admin.service';
import { apiErrorMessage } from '../../core/utils/api-error';
import { cop, initials, statusLabel } from '../../core/utils/format';

type Section = 'summary' | 'drivers' | 'trips' | 'fares' | 'reports' | 'audit';

/** Mockup 7 · Admin · Dashboard (HU-15 y módulo de administrador) */
@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
  imports: [FormsModule, DatePipe, IonContent, IonSpinner],
})
export class AdminPage {
  private auth = inject(AuthService);
  private admin = inject(AdminService);
  router = inject(Router);

  readonly cop = cop;
  readonly initials = initials;
  readonly statusLabel = statusLabel;

  user = this.auth.user;
  section: Section = 'summary';
  search = '';
  error = '';
  toast = '';
  loading = false;

  readonly nav: { key: Section; label: string; icon: string }[] = [
    { key: 'summary', label: 'Resumen', icon: 'grid' },
    { key: 'drivers', label: 'Conductores', icon: 'user' },
    { key: 'trips', label: 'Viajes', icon: 'car' },
    { key: 'fares', label: 'Tarifas', icon: 'money' },
    { key: 'reports', label: 'Reportes', icon: 'chart' },
    { key: 'audit', label: 'Auditoría', icon: 'shield' },
  ];

  // Resumen
  stats: any = {};
  recentTrips: any[] = [];
  recentIncidents: any[] = [];
  pending: any[] = [];
  activeFare: any = null;

  // Conductores
  drivers: any[] = [];
  driverFilter = '';

  // Viajes
  trips: any[] = [];
  tripFilters = { status: '', date: '', driver_id: '', client_id: '' };

  // Tarifas
  fares: any[] = [];
  fareOpen = false;
  fareSaving = false;
  fareForm: FareData = this.emptyFare();

  // Reportes / auditoría
  report: any = null;
  logs: any[] = [];

  // Modal aprobar/rechazar
  decision: { driver: any; status: 'approved' | 'rejected' | 'suspended'; notes: string } | null = null;
  deciding = false;

  ionViewWillEnter(): void {
    this.user = this.auth.user;
    this.go(this.section);
  }

  go(s: Section): void {
    this.section = s;
    this.error = '';
    switch (s) {
      case 'summary':
        return this.loadSummary();
      case 'drivers':
        return this.loadDrivers();
      case 'trips':
        return this.loadTrips();
      case 'fares':
        return this.loadFares();
      case 'reports':
        return this.loadReports();
      case 'audit':
        return this.loadAudit();
    }
  }

  get title(): string {
    return {
      summary: 'Resumen de la plataforma',
      drivers: 'Conductores',
      trips: 'Viajes',
      fares: 'Tarifas',
      reports: 'Reportes',
      audit: 'Auditoría',
    }[this.section];
  }

  // ---------- Carga de datos ----------

  loadSummary(): void {
    this.loading = true;
    this.admin.dashboard().subscribe({
      next: (res) => {
        this.loading = false;
        this.stats = res?.stats ?? {};
        this.recentTrips = asList(res, 'recent_trips');
        this.recentIncidents = asList(res, 'recent_incidents');
      },
      error: (err) => this.fail(err),
    });
    this.admin.drivers('pending').subscribe({
      next: (res) => (this.pending = asList(res, 'drivers')),
      error: () => (this.pending = []),
    });
    this.admin.activeFare().subscribe({
      next: (res) => (this.activeFare = res?.fare ?? null),
      error: () => (this.activeFare = null),
    });
  }

  loadDrivers(): void {
    this.loading = true;
    this.admin.drivers(this.driverFilter || undefined).subscribe({
      next: (res) => {
        this.loading = false;
        this.drivers = asList(res, 'drivers');
      },
      error: (err) => this.fail(err),
    });
  }

  loadTrips(): void {
    this.loading = true;
    this.admin.trips(this.tripFilters).subscribe({
      next: (res) => {
        this.loading = false;
        this.trips = asList(res, 'trips');
      },
      error: (err) => this.fail(err),
    });
  }

  clearTripFilters(): void {
    this.tripFilters = { status: '', date: '', driver_id: '', client_id: '' };
    this.loadTrips();
  }

  loadFares(): void {
    this.loading = true;
    this.admin.fares().subscribe({
      next: (res) => {
        this.loading = false;
        this.fares = asList(res, 'fares');
      },
      error: (err) => this.fail(err),
    });
  }

  loadReports(): void {
    this.loading = true;
    this.admin.reports().subscribe({
      next: (res) => {
        this.loading = false;
        const { success, message, ...rest } = res ?? {};
        this.report = rest?.report ?? rest?.reports ?? rest?.data ?? rest;
      },
      error: (err) => this.fail(err),
    });
  }

  loadAudit(): void {
    this.loading = true;
    this.admin.auditLogs().subscribe({
      next: (res) => {
        this.loading = false;
        this.logs = asList(res, 'logs', 'audit_logs');
      },
      error: (err) => this.fail(err),
    });
  }

  private fail(err: any): void {
    this.loading = false;
    this.error = apiErrorMessage(err, 'No se pudo cargar la información');
  }

  // ---------- Búsqueda ----------

  matches(row: any): boolean {
    const q = this.search.trim().toLowerCase();
    if (!q) return true;
    return JSON.stringify(row ?? {}).toLowerCase().includes(q);
  }

  filtered(list: any[]): any[] {
    return list.filter((r) => this.matches(r));
  }

  // ---------- Aprobación de conductores (HU-15) ----------

  openDecision(driver: any, status: 'approved' | 'rejected' | 'suspended'): void {
    this.decision = {
      driver,
      status,
      notes: status === 'approved' ? 'Documentación de SOAT y licencia verificada.' : '',
    };
  }

  confirmDecision(): void {
    const d = this.decision;
    if (!d) return;
    if (d.status !== 'approved' && !d.notes.trim()) {
      this.error = 'Escribe el motivo';
      return;
    }
    this.deciding = true;
    this.admin.setApproval(d.driver.id, d.status, d.notes).subscribe({
      next: (res) => {
        this.deciding = false;
        this.decision = null;
        this.showToast(res?.message ?? 'Estado actualizado');
        this.go(this.section);
      },
      error: (err) => {
        this.deciding = false;
        this.error = apiErrorMessage(err, 'No se pudo actualizar el conductor');
      },
    });
  }

  approvalLabel(s: string): string {
    return { pending: 'Pendiente', approved: 'Aprobado', rejected: 'Rechazado', suspended: 'Suspendido' }[s] ?? s;
  }

  // ---------- Tarifas ----------

  private emptyFare(): FareData {
    return { name: '', base_fare: 3800, price_per_km: 1250, price_per_minute: 250, minimum_fare: 6500, surge_multiplier: 1, active: true };
  }

  openFare(): void {
    this.fareForm = this.activeFare
      ? {
          name: '',
          base_fare: Number(this.activeFare.base_fare),
          price_per_km: Number(this.activeFare.price_per_km),
          price_per_minute: Number(this.activeFare.price_per_minute),
          minimum_fare: Number(this.activeFare.minimum_fare),
          surge_multiplier: Number(this.activeFare.surge_multiplier),
          active: true,
        }
      : this.emptyFare();
    this.fareOpen = true;
  }

  saveFare(): void {
    const f = this.fareForm;
    if (!f.name.trim()) {
      this.error = 'Ponle un nombre a la tarifa';
      return;
    }
    this.fareSaving = true;
    const data: FareData = {
      name: f.name.trim(),
      base_fare: Number(f.base_fare),
      price_per_km: Number(f.price_per_km),
      price_per_minute: Number(f.price_per_minute),
      minimum_fare: Number(f.minimum_fare),
      surge_multiplier: Number(f.surge_multiplier),
      active: !!f.active,
    };
    this.admin.createFare(data).subscribe({
      next: (res) => {
        this.fareSaving = false;
        this.fareOpen = false;
        this.showToast(res?.message ?? 'Tarifa creada');
        this.go(this.section);
      },
      error: (err) => {
        this.fareSaving = false;
        this.error = apiErrorMessage(err, 'No se pudo crear la tarifa');
      },
    });
  }

  // ---------- Utilidades de tabla genérica (reportes/auditoría) ----------

  isNumber(v: any): boolean {
    return typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !isNaN(Number(v)) && v.length < 15);
  }

  isList(v: any): boolean {
    return Array.isArray(v);
  }

  isObject(v: any): boolean {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
  }

  entries(obj: any): { key: string; value: any }[] {
    return Object.entries(obj ?? {}).map(([key, value]) => ({ key, value }));
  }

  columns(list: any[]): string[] {
    const keys = new Set<string>();
    list.slice(0, 5).forEach((row) => Object.keys(row ?? {}).forEach((k) => keys.add(k)));
    return [...keys].filter((k) => !['updated_at', 'password', 'remember_token'].includes(k)).slice(0, 7);
  }

  cell(value: any): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'object') {
      return value.name ?? value.user?.name ?? value.plate ?? value.email ?? JSON.stringify(value).slice(0, 60);
    }
    const s = String(value);
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return new Date(s).toLocaleString('es-CO');
    return s;
  }

  label(key: string): string {
    return key.replace(/_/g, ' ');
  }

  showToast(msg: string): void {
    this.toast = msg;
    setTimeout(() => (this.toast = ''), 3000);
  }

  logout(): void {
    const done = () => this.router.navigateByUrl('/login', { replaceUrl: true });
    this.auth.logout().subscribe({
      next: done,
      error: () => {
        this.auth.clearSession();
        done();
      },
    });
  }
}
