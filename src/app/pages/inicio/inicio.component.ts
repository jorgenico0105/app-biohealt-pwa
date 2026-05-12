import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { forkJoin, catchError, of } from 'rxjs';
import { AuthStore } from '../../core/store/auth.store';
import { NutricionService, ResumenDiario, NutricionXP, NutricionDieta } from '../../core/services/nutricion.service';
import { MacroRowComponent } from '../../shared/components/macro-row/macro-row.component';

const FALLBACK_XP: NutricionXP = {
  paciente_id: 0, nivel: 1, xp_total: 0,
  racha_actual: 0, racha_maxima: 0, ultimo_registro: '',
};

const TIPO_ICON: Record<number, string> = {
  1: 'cafe-outline', 2: 'nutrition-outline', 3: 'restaurant-outline',
  4: 'nutrition-outline', 5: 'moon-outline',
};

@Component({
  selector: 'app-inicio',
  imports: [CommonModule, MacroRowComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="page">
      <!-- Header -->
      <div class="page-header">
        <div class="header-name">
          <span class="greeting">Buenos días</span>
          <span class="user-name">{{ auth.user() ?? 'Bienvenido' }}</span>
        </div>
        <button class="avatar-btn" (click)="router.navigate(['/tabs/perfil'])">{{ initials() }}</button>
      </div>

      <!-- Calorie card -->
      <div class="card calorie-card">
        <div class="stats-row">
          <div class="stat-col">
            <span class="stat-label">META</span>
            <span class="stat-val">{{ calGoal() | number:'1.0-0' }}</span>
          </div>
          <div class="stat-col">
            <span class="stat-label">CONSUMIDAS</span>
            <span class="stat-val" style="color:#2f6648">{{ consumed() | number:'1.0-0' }}</span>
          </div>
          @if (burned() > 0) {
            <div class="stat-col">
              <span class="stat-label">QUEMADAS</span>
              <span class="stat-val" style="color:#F43F5E">{{ burned() | number:'1.0-0' }}</span>
            </div>
          }
        </div>

        <div class="ring-row">
          <div class="cal-ring-wrap">
            <svg width="148" height="148" viewBox="0 0 148 148">
              <g transform="rotate(-90 74 74)">
                <circle cx="74" cy="74" r="58" stroke="#eae3c6" stroke-width="13" fill="none" stroke-linecap="round"/>
                <circle cx="74" cy="74" r="58" stroke="#2f6648" stroke-width="13" fill="none"
                  stroke-linecap="round"
                  [attr.stroke-dasharray]="circ"
                  [attr.stroke-dashoffset]="dashOffset()"/>
              </g>
            </svg>
            <div class="ring-center">
              <span class="ring-num">{{ netCals() | number:'1.0-0' }}</span>
              <span class="ring-unit">KCAL</span>
            </div>
          </div>
          <div class="burn-col">
            <div class="burn-item">
              <span class="burn-label">RACHA</span>
              <span class="burn-val" style="color:#F59E0B">{{ xp().racha_actual }}d</span>
            </div>
            <div class="burn-divider"></div>
            <div class="burn-item">
              <span class="burn-label">RESTANTES</span>
              <span class="burn-val" style="color:#136967">{{ remaining() | number:'1.0-0' }}</span>
            </div>
          </div>
        </div>

        <div class="deficit-badge">
          <ion-icon [name]="deficit() <= 0 ? 'trending-down' : 'trending-up'"></ion-icon>
          <span>{{ deficit() <= 0 ? 'Déficit: ' + absDeficit() + ' kcal' : 'Superávit: ' + deficit() + ' kcal' }}</span>
        </div>
      </div>

      <!-- Macros -->
      <div class="card">
        <h3 class="section-title">Macros del día</h3>
        <div class="macro-list">
          <app-macro-row label="PROTEÍNA" [current]="protCurr()" [goal]="protGoal()" color="#F59E0B" />
          <app-macro-row label="CARBOS"   [current]="carbCurr()" [goal]="carbGoal()" color="#2f6648" />
          <app-macro-row label="GRASAS"   [current]="fatCurr()"  [goal]="fatGoal()"  color="#0EA5E9" />
        </div>
      </div>

      <!-- Comidas de hoy -->
      <div class="card">
        <div class="card-header">
          <h3 class="section-title">Comidas de hoy</h3>
          <button class="see-all-btn" (click)="router.navigate(['/tabs/dieta'])">+ Agregar</button>
        </div>
        @if (registros().length === 0) {
          <p class="empty-text">Sin registros hoy. ¡Registrá tu primera comida!</p>
        } @else {
          @for (r of registros(); track r.id) {
            <div class="meal-row">
              <div class="meal-icon" [class.consumed]="r.estado === 'C'">
                <ion-icon [name]="tipoIcon(r.tipo_comida_id)"></ion-icon>
              </div>
              <div class="meal-info">
                <span class="meal-name">{{ r.descripcion_libre ?? 'Comida ' + r.tipo_comida_id }}</span>
                <span class="meal-time">{{ r.creado_en ? r.creado_en.slice(11,16) : '' }}</span>
              </div>
              <div class="meal-right">
                <span class="meal-cal">{{ r.calorias_consumidas ?? 0 }} kcal</span>
                @if (r.estado === 'C') {
                  <span class="consumida-badge">
                    <ion-icon name="checkmark"></ion-icon>consumida
                  </span>
                }
              </div>
            </div>
          }
        }
      </div>

      <!-- Ejercicios -->
      @if (ejercicios().length > 0) {
        <div class="card">
          <h3 class="section-title">Ejercicio hoy</h3>
          @for (e of ejercicios(); track e.id) {
            <div class="meal-row">
              <div class="meal-icon exercise"><ion-icon name="barbell-outline"></ion-icon></div>
              <div class="meal-info">
                <span class="meal-name">{{ e.nombre_libre ?? 'Ejercicio' }}</span>
                <span class="meal-time">{{ e.duracion_min_real ? e.duracion_min_real + ' min' : '' }}</span>
              </div>
              @if (e.calorias_quemadas) {
                <span class="meal-cal rose">-{{ e.calorias_quemadas }} kcal</span>
              }
            </div>
          }
        </div>
      }

      <!-- Acceso rápido -->
      <h3 class="section-title" style="margin:0 2px">Acceso rápido</h3>
      <div class="quick-row">
        <button class="quick-card" (click)="router.navigate(['/tabs/logros'])">
          <div class="quick-icon" style="background:rgba(245,158,11,0.1)"><ion-icon name="trophy" style="color:#F59E0B"></ion-icon></div>
          <span class="quick-val">Nv. {{ xp().nivel }}</span>
          <span class="quick-label">Logros</span>
        </button>
        <button class="quick-card" (click)="router.navigate(['/tabs/peso'])">
          <div class="quick-icon" style="background:rgba(14,165,233,0.1)"><ion-icon name="scale-outline" style="color:#0EA5E9"></ion-icon></div>
          <span class="quick-label">Mi Peso</span>
        </button>
        <button class="quick-card" (click)="router.navigate(['/tabs/sintomas'])">
          <div class="quick-icon" style="background:rgba(244,63,94,0.1)"><ion-icon name="pulse" style="color:#F43F5E"></ion-icon></div>
          <span class="quick-label">Síntomas</span>
        </button>
        <button class="quick-card" (click)="router.navigate(['/tabs/turnos'])">
          <div class="quick-icon" style="background:rgba(47,102,72,0.1)"><ion-icon name="calendar-outline" style="color:#2f6648"></ion-icon></div>
          <span class="quick-label">Turnos</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    .page {
      padding: 16px 16px 24px; display: flex; flex-direction: column;
      gap: 14px; background: #fff9ea; min-height: 100%;
    }
    .page-header { display: flex; justify-content: space-between; align-items: center; }
    .header-name { display: flex; flex-direction: column; max-width: 80%; }
    .greeting    { font-size: 13px; font-weight: 500; color: #2f6648; }
    .user-name   { font-size: 20px; font-weight: 800; color: #1f1c0a; letter-spacing: -0.3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .avatar-btn  { width: 44px; height: 44px; border-radius: 14px; background: #2f6648; border: none; cursor: pointer; color: #fff; font-size: 18px; font-weight: 800; flex-shrink: 0; }

    .card { background: #f6eed1; border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .calorie-card { gap: 14px; }
    .card-header { display: flex; justify-content: space-between; align-items: center; }
    .section-title { font-size: 16px; font-weight: 700; color: #1f1c0a; margin: 0; }
    .see-all-btn { background: transparent; border: none; color: #2f6648; font-size: 13px; font-weight: 600; cursor: pointer; }

    .stats-row { display: flex; justify-content: space-around; }
    .stat-col  { display: flex; flex-direction: column; align-items: center; gap: 2px; }
    .stat-label { font-size: 10px; font-weight: 700; letter-spacing: 0.6px; color: #2f6648; }
    .stat-val   { font-size: 22px; font-weight: 800; color: #1f1c0a; }

    .ring-row   { display: flex; align-items: center; justify-content: center; gap: 24px; }
    .cal-ring-wrap { position: relative; width: 148px; height: 148px; flex-shrink: 0; }
    .cal-ring-wrap svg { position: absolute; top: 0; left: 0; }
    .ring-center { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
    .ring-num  { font-size: 26px; font-weight: 800; color: #1f1c0a; }
    .ring-unit { font-size: 10px; font-weight: 700; letter-spacing: 0.8px; color: #2f6648; }
    .burn-col  { display: flex; flex-direction: column; gap: 12px; }
    .burn-item { display: flex; flex-direction: column; align-items: center; }
    .burn-label { font-size: 10px; font-weight: 700; letter-spacing: 0.6px; color: #2f6648; }
    .burn-val   { font-size: 22px; font-weight: 800; }
    .burn-divider { height: 1px; width: 60px; background: rgba(192,201,192,0.15); }

    .deficit-badge { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 8px; border-radius: 20px; background: rgba(47,102,72,0.10); border: 1px solid rgba(47,102,72,0.20); font-size: 13px; font-weight: 600; color: #2f6648; }

    .macro-list { display: flex; flex-direction: column; gap: 8px; }

    .meal-row  { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 14px; background: #fbf4d6; }
    .meal-icon { width: 42px; height: 42px; border-radius: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 20px; background: rgba(245,158,11,0.1); color: #F59E0B; }
    .meal-icon.consumed { background: rgba(47,102,72,0.1); color: #2f6648; }
    .meal-icon.exercise { background: rgba(244,63,94,0.1); color: #F43F5E; }
    .meal-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .meal-name { font-size: 14px; font-weight: 700; color: #1f1c0a; }
    .meal-time { font-size: 12px; color: #2f6648; }
    .meal-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .meal-cal  { font-size: 13px; font-weight: 600; color: #136967; }
    .meal-cal.rose { color: #F43F5E; }
    .consumida-badge { display: flex; align-items: center; gap: 3px; padding: 2px 6px; border-radius: 8px; background: rgba(47,102,72,0.10); color: #2f6648; font-size: 10px; font-weight: 600; }

    .empty-text { font-size: 13px; text-align: center; padding: 12px 0; color: #2f6648; margin: 0; }

    .quick-row  { display: flex; gap: 8px; }
    .quick-card { flex: 1; display: flex; flex-direction: column; align-items: center; padding: 12px 6px; border-radius: 16px; gap: 4px; background: #f6eed1; border: none; cursor: pointer; }
    .quick-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; margin-bottom: 2px; }
    .quick-val   { font-size: 15px; font-weight: 800; color: #1f1c0a; }
    .quick-label { font-size: 11px; font-weight: 600; color: #2f6648; text-align: center; }
  `],
})
export class InicioComponent implements OnInit {
  auth   = inject(AuthStore);
  router = inject(Router);
  private svc = inject(NutricionService);

  xpData      = signal<NutricionXP>(FALLBACK_XP);
  resumen     = signal<ResumenDiario | null>(null);
  activaDieta = signal<NutricionDieta | null>(null);

  xp       = computed(() => this.xpData());
  consumed = computed(() => this.resumen()?.calorias_consumidas ?? 0);
  burned   = computed(() => this.resumen()?.calorias_quemadas ?? 0);
  netCals  = computed(() => { const n = this.consumed() - this.burned(); return n > 0 ? n : this.consumed(); });
  calGoal  = computed(() => this.resumen()?.calorias_objetivo || this.activaDieta()?.calorias_dia_objetivo || 2000);
  protGoal = computed(() => this.activaDieta()?.proteinas_g_dia ?? 120);
  carbGoal = computed(() => this.activaDieta()?.carbohidratos_g_dia ?? 200);
  fatGoal  = computed(() => this.activaDieta()?.grasas_g_dia ?? 60);
  protCurr = computed(() => this.resumen()?.proteinas_g ?? 0);
  carbCurr = computed(() => this.resumen()?.carbohidratos_g ?? 0);
  fatCurr  = computed(() => this.resumen()?.grasas_g ?? 0);
  remaining  = computed(() => Math.max(0, this.calGoal() - this.netCals()));
  deficit    = computed(() => Math.round(this.netCals() - this.calGoal()));
  absDeficit = computed(() => Math.abs(this.deficit()));
  registros  = computed(() => this.resumen()?.registros_comida ?? []);
  ejercicios = computed(() => this.resumen()?.registros_ejercicio ?? []);
  initials   = computed(() => { const u = this.auth.user(); return u ? u[0].toUpperCase() : 'U'; });

  circ = 2 * Math.PI * 58;
  dashOffset = computed(() => {
    const progress = this.calGoal() > 0 ? Math.min(this.netCals() / this.calGoal(), 1) : 0;
    return this.circ * (1 - progress);
  });

  tipoIcon(id: number): string { return TIPO_ICON[id] ?? 'restaurant-outline'; }

  ngOnInit(): void {
    const pid = this.auth.pacienteId();
    if (!pid) return;
    const today = new Date().toISOString().split('T')[0];
    forkJoin({
      xp:     this.svc.getXP(pid).pipe(catchError(() => of(FALLBACK_XP))),
      resumen: this.svc.getResumenDiario(pid, today).pipe(catchError(() => of(null))),
      dietas: this.svc.getDietas(pid).pipe(catchError(() => of(null))),
    }).subscribe(({ xp, resumen, dietas }) => {
      if (xp) this.xpData.set(xp);
      if (resumen) this.resumen.set(resumen);
      if (dietas) {
        this.activaDieta.set(dietas.data.find(d => d.estado === 'ACTIVA') ?? null);
      }
    });
  }
}
