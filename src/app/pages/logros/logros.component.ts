import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, of, forkJoin } from 'rxjs';
import { AuthStore } from '../../core/store/auth.store';
import { NutricionService, NutricionXP, NutricionLogro } from '../../core/services/nutricion.service';

function nivelTitulo(nivel: number): string {
  if (nivel <= 2)  return 'Principiante';
  if (nivel <= 5)  return 'Constante';
  if (nivel <= 10) return 'Avanzado';
  return 'Experto en Salud';
}

function logroColor(logro: NutricionLogro): string {
  const cat = (logro.categoria ?? '').toLowerCase();
  if (cat.includes('racha'))     return '#f59e0b';
  if (cat.includes('ejercicio')) return '#38bdf8';
  if (cat.includes('peso'))      return '#4ade80';
  return '#22c55e';
}

@Component({
  selector: 'app-logros',
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="page">
      <h2 class="page-title">Logros</h2>

      <!-- XP Card -->
      @if (loading()) {
        <div class="loading-wrap"><div class="spinner"></div></div>
      }
      @if (!loading() && xp()) {
        <div class="xp-card">
          <div class="xp-top">
            <div class="level-badge">{{ xp()!.nivel }}</div>
            <div class="xp-info">
              <span class="level-title">Nivel {{ xp()!.nivel }} · {{ nivelTitulo(xp()!.nivel) }}</span>
              <span class="xp-label">{{ xp()!.xp_total }} / {{ xpGoal() }} XP para el siguiente nivel</span>
            </div>
          </div>
          <div class="xp-track">
            <div class="xp-fill" [style.width]="(xpPct() * 100) + '%'"></div>
          </div>
          <span class="xp-pct">{{ (xpPct() * 100).toFixed(0) }}% completado</span>
          <div class="rachas-row">
            <div class="racha-badge amber">
              <ion-icon name="flame" style="color:#d97706"></ion-icon>
              <span class="racha-num amber">{{ xp()!.racha_actual }}</span>
              <span class="racha-lbl">días racha</span>
            </div>
            <div class="racha-badge green">
              <ion-icon name="trophy" style="color:#2f6648"></ion-icon>
              <span class="racha-num green">{{ xp()!.racha_maxima }}</span>
              <span class="racha-lbl">racha máx.</span>
            </div>
          </div>
        </div>
      }

      <!-- Logros -->
      <div class="card">
        <h3 class="card-title">Logros obtenidos ({{ logros().length }})</h3>
        @if (loading()) {
          <div class="loading-wrap"><div class="spinner"></div></div>
        } @else if (logros().length === 0) {
          <div class="empty">
            <ion-icon name="ribbon-outline" style="font-size:32px;color:#136967;opacity:0.5"></ion-icon>
            <p>Aún no obtuviste logros. ¡Seguí registrando!</p>
          </div>
        } @else {
          <div class="badges-grid">
            @for (logro of logros(); track logro.id) {
              <div class="badge-item" [style.background]="logroColor(logro) + '18'" [style.border-color]="logroColor(logro) + '35'">
                <div class="badge-icon" [style.background]="logroColor(logro) + '25'">
                  <ion-icon [name]="logro.icono || 'trophy'" [style.color]="logroColor(logro)"></ion-icon>
                </div>
                <span class="badge-name">{{ logro.nombre }}</span>
                <span class="badge-xp" [style.color]="logroColor(logro)">+{{ logro.puntos_xp }} XP</span>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page { padding: 16px 16px 32px; display: flex; flex-direction: column; gap: 14px; background: #fff9ea; min-height: 100%; }
    .page-title { font-size: 24px; font-weight: 800; color: #1f1c0a; margin: 0; }

    .loading-wrap { display: flex; justify-content: center; padding: 32px; }
    .spinner { width: 28px; height: 28px; border: 3px solid rgba(47,102,72,0.2); border-top-color: #2f6648; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .xp-card { background: #f6eed1; border: 1px solid rgba(47,102,72,0.2); border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .xp-top  { display: flex; align-items: center; gap: 14px; }
    .level-badge { width: 52px; height: 52px; border-radius: 16px; background: rgba(47,102,72,0.12); display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; color: #2f6648; flex-shrink: 0; }
    .xp-info { display: flex; flex-direction: column; gap: 3px; }
    .level-title { font-size: 15px; font-weight: 700; color: #1f1c0a; }
    .xp-label { font-size: 12px; color: #136967; }
    .xp-track { height: 8px; border-radius: 4px; background: rgba(47,102,72,0.12); overflow: hidden; }
    .xp-fill  { height: 100%; border-radius: 4px; background: #2f6648; transition: width 0.5s ease; }
    .xp-pct   { font-size: 12px; color: #136967; text-align: right; }
    .rachas-row { display: flex; gap: 10px; }
    .racha-badge { flex: 1; display: flex; align-items: center; gap: 6px; padding: 12px; border-radius: 12px; }
    .racha-badge.amber { background: rgba(245,158,11,0.1); }
    .racha-badge.green { background: rgba(47,102,72,0.1); }
    .racha-num { font-size: 20px; font-weight: 800; }
    .racha-num.amber { color: #d97706; }
    .racha-num.green { color: #2f6648; }
    .racha-lbl { font-size: 11px; color: #136967; }

    .card { background: #f6eed1; border-radius: 16px; border: 1px solid rgba(47,102,72,0.15); padding: 16px; }
    .card-title { font-size: 16px; font-weight: 700; color: #1f1c0a; margin: 0 0 14px; }
    .badges-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .badge-item { width: calc(33.33% - 6px); min-width: 90px; display: flex; flex-direction: column; align-items: center; padding: 12px 8px; border-radius: 14px; border: 1px solid; gap: 6px; box-sizing: border-box; }
    .badge-icon { width: 46px; height: 46px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 22px; }
    .badge-name { font-size: 10px; font-weight: 600; color: #1f1c0a; text-align: center; line-height: 1.3; }
    .badge-xp   { font-size: 10px; font-weight: 700; }
    .empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px; }
    .empty p { font-size: 13px; color: #136967; text-align: center; margin: 0; }
  `],
})
export class LogrosComponent implements OnInit {
  auth = inject(AuthStore);
  private nutricionSvc = inject(NutricionService);

  loading = signal(true);
  xp      = signal<NutricionXP | null>(null);
  logros  = signal<NutricionLogro[]>([]);

  xpGoal = () => { const x = this.xp(); return x ? x.nivel * 100 : 100; };
  xpPct  = () => { const x = this.xp(); return x ? Math.min(x.xp_total / this.xpGoal(), 1) : 0; };
  nivelTitulo = nivelTitulo;
  logroColor  = logroColor;

  ngOnInit(): void {
    const pid = this.auth.pacienteId();
    if (!pid) { this.loading.set(false); return; }
    forkJoin({
      xp:     this.nutricionSvc.getXP(pid).pipe(catchError(() => of(null))),
      logros: this.nutricionSvc.getLogros(pid).pipe(catchError(() => of({ data: [] } as any))),
    }).subscribe(({ xp, logros }) => {
      this.xp.set(xp);
      this.logros.set(logros?.data ?? []);
      this.loading.set(false);
    });
  }
}
