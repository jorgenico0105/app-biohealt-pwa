import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { switchMap, catchError, of, forkJoin } from 'rxjs';
import { AuthStore } from '../../core/store/auth.store';
import { NutricionService, NutricionDieta, NutricionMenu, NutricionMenuDetalle, ResumenDiario, NutricionRegistroComida, CrearRegistroComidaPayload } from '../../core/services/nutricion.service';
import { MacroRowComponent } from '../../shared/components/macro-row/macro-row.component';

const SHORT_DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const TIPO_COLORS: Record<number, string> = { 1: '#F59E0B', 2: '#8B5CF6', 3: '#2f6648', 4: '#136967', 5: '#0EA5E9' };
const TIPO_NAMES: Record<number, string>  = { 1: 'DESAYUNO', 2: 'MEDIA MAÑANA', 3: 'ALMUERZO', 4: 'MEDIA TARDE', 5: 'MERIENDA/CENA' };
const TIPO_TIMES: Record<number, string>  = { 1: '7:00 AM', 2: '10:00 AM', 3: '1:00 PM', 4: '4:00 PM', 5: '7:00 PM' };

function todayDiaNumero(fechaInicio: string): number {
  const [y, m, d] = fechaInicio.substring(0, 10).split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1;
}

function diaLabel(fechaInicio: string, diaNumero: number): string {
  const [y, m, d] = fechaInicio.substring(0, 10).split('-').map(Number);
  const date = new Date(y, m - 1, d + diaNumero - 1);
  return SHORT_DAYS[date.getDay()];
}

@Component({
  selector: 'app-dieta',
  imports: [CommonModule, MacroRowComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="page">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h2 class="page-title">Mi Dieta</h2>
          @if (activaDieta()) {
            <p class="page-sub">{{ activaDieta()!.nombre }}</p>
          }
        </div>
        <button class="info-btn" (click)="router.navigate(['/tabs/docs'])">
          <ion-icon name="document-text-outline"></ion-icon>
        </button>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="loading-wrap">
          <div class="spinner"></div>
        </div>
      }

      <!-- No diet -->
      @if (!loading() && !activaDieta()) {
        <div class="card empty-card">
          <ion-icon name="nutrition-outline" style="font-size:48px;color:#2f6648;opacity:0.5"></ion-icon>
          <p style="color:#2f6648;font-size:15px;font-weight:600;text-align:center;margin:0">Sin dieta activa</p>
          <p style="color:#136967;font-size:13px;text-align:center;margin:0">Tu nutricionista aún no asignó una dieta.</p>
        </div>
      }

      @if (!loading() && activaDieta()) {
        <!-- Diet summary card -->
        <div class="card diet-summary">
          <div class="diet-badge">
            <ion-icon name="checkmark-circle" style="color:#2f6648"></ion-icon>
            <span>Dieta Activa</span>
          </div>
          @if (activaDieta()!.calorias_dia_objetivo) {
            <div class="goal-row">
              <span class="goal-label">Meta calórica</span>
              <span class="goal-val">{{ activaDieta()!.calorias_dia_objetivo }} kcal/día</span>
            </div>
          }
          @if (activaDieta()!.objetivo) {
            <p class="diet-objetivo">{{ activaDieta()!.objetivo }}</p>
          }
          @if (activaDieta()!.proteinas_g_dia || activaDieta()!.carbohidratos_g_dia || activaDieta()!.grasas_g_dia) {
            <div class="macro-list">
              <app-macro-row label="PROTEÍNA" [current]="resumen()?.proteinas_g ?? 0" [goal]="activaDieta()!.proteinas_g_dia ?? 0" color="#F59E0B" />
              <app-macro-row label="CARBOS"   [current]="resumen()?.carbohidratos_g ?? 0" [goal]="activaDieta()!.carbohidratos_g_dia ?? 0" color="#2f6648" />
              <app-macro-row label="GRASAS"   [current]="resumen()?.grasas_g ?? 0" [goal]="activaDieta()!.grasas_g_dia ?? 0" color="#0EA5E9" />
            </div>
          }
        </div>

        <!-- Day selector -->
        @if (diasPresentes().length > 0) {
          <div class="day-scroll">
            @for (dia of diasPresentes(); track dia) {
              <button class="day-chip" [class.active]="selectedDay() === dia" (click)="selectedDay.set(dia)">
                <span class="day-chip-day">{{ menuActivo() ? diaLabel(menuActivo()!.fecha_inicio, dia) : 'D' + dia }}</span>
                <span class="day-chip-num">{{ dia }}</span>
                @if (dia === todayDia()) { <div class="today-dot"></div> }
              </button>
            }
          </div>
        }

        <!-- Meal cards for selected day -->
        @if (detallesDia().length === 0 && !loading()) {
          <div class="card" style="align-items:center;padding:24px">
            <ion-icon name="calendar-outline" style="font-size:36px;color:#2f6648;opacity:0.4"></ion-icon>
            <p style="color:#2f6648;font-size:14px;margin:8px 0 0;text-align:center">Sin comidas para este día</p>
          </div>
        }

        @for (detalle of detallesDia(); track detalle.id) {
          <div class="meal-card">
            <div class="meal-card-header" [style.border-left]="'4px solid ' + tipoColor(detalle.tipo_comida_id)">
              <div class="meal-card-info">
                <div class="meal-tag" [style.background]="tipoColor(detalle.tipo_comida_id) + '18'" [style.color]="tipoColor(detalle.tipo_comida_id)">
                  {{ tipoName(detalle.tipo_comida_id) }}
                </div>
                <span class="meal-name">{{ detalle.nombre_comida ?? detalle.instrucciones ?? 'Comida' }}</span>
                @if (detalle.calorias_total) {
                  <span class="meal-cal">{{ detalle.calorias_total }} kcal</span>
                }
              </div>
              <div class="meal-card-right">
                <span class="meal-time">{{ tipoTime(detalle.tipo_comida_id) }}</span>
                @if (isConsumed(detalle)) {
                  <span class="consumed-badge"><ion-icon name="checkmark-circle" style="color:#2f6648"></ion-icon></span>
                }
              </div>
            </div>

            <!-- Alimentos -->
            @if (detalle.alimentos && detalle.alimentos.length > 0) {
              <div class="alimentos-list">
                @for (ali of detalle.alimentos; track ali.id) {
                  <div class="alimento-row">
                    <span class="alimento-name">{{ ali.Alimento?.nombre ?? 'Alimento' }}</span>
                    <span class="alimento-gram">{{ ali.gramos_asignados }}g</span>
                  </div>
                }
              </div>
            }

            <!-- Instrucciones -->
            @if (detalle.instrucciones) {
              <p class="instrucciones">{{ detalle.instrucciones }}</p>
            }

            @if (!isConsumed(detalle) && selectedDay() === todayDia()) {
              <button class="mark-btn" [disabled]="registering() === detalle.id" (click)="registrarConsumo(detalle)">
                @if (registering() === detalle.id) { <div class="spinner-sm"></div> }
                @else { <ion-icon name="checkmark-outline" style="font-size:16px;color:#fff"></ion-icon> }
                Marcar consumida
              </button>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    .page { padding: 16px 16px 24px; display: flex; flex-direction: column; gap: 14px; background: #fff9ea; min-height: 100%; }

    .page-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .page-title  { font-size: 22px; font-weight: 800; color: #1f1c0a; margin: 0; }
    .page-sub    { font-size: 13px; color: #136967; margin: 4px 0 0; }
    .info-btn    { background: #f6eed1; border: none; border-radius: 12px; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; font-size: 20px; color: #2f6648; cursor: pointer; }

    .loading-wrap { display: flex; justify-content: center; padding: 48px 0; }
    .spinner { width: 28px; height: 28px; border: 3px solid rgba(47,102,72,0.2); border-top-color: #2f6648; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .card { background: #f6eed1; border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .empty-card { align-items: center; padding: 32px 16px; gap: 12px; }

    .diet-summary { gap: 12px; }
    .diet-badge   { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #2f6648; }
    .goal-row     { display: flex; justify-content: space-between; align-items: center; }
    .goal-label   { font-size: 13px; color: #136967; font-weight: 500; }
    .goal-val     { font-size: 15px; font-weight: 800; color: #1f1c0a; }
    .diet-objetivo { font-size: 13px; color: #136967; line-height: 1.5; margin: 0; font-style: italic; }
    .macro-list   { display: flex; flex-direction: column; gap: 8px; }

    /* Day selector */
    .day-scroll { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none; }
    .day-scroll::-webkit-scrollbar { display: none; }
    .day-chip {
      display: flex; flex-direction: column; align-items: center; gap: 2px;
      min-width: 52px; padding: 10px 8px; border-radius: 14px;
      background: #f6eed1; border: 1.5px solid transparent; cursor: pointer;
      position: relative; flex-shrink: 0; transition: all 0.15s;
    }
    .day-chip.active { background: #2f6648; border-color: #2f6648; }
    .day-chip-day { font-size: 11px; font-weight: 600; color: #2f6648; }
    .day-chip.active .day-chip-day { color: #fff; }
    .day-chip-num { font-size: 16px; font-weight: 800; color: #1f1c0a; }
    .day-chip.active .day-chip-num { color: #fff; }
    .today-dot { width: 5px; height: 5px; border-radius: 50%; background: #F59E0B; position: absolute; bottom: 6px; }
    .day-chip.active .today-dot { background: rgba(255,255,255,0.8); }

    /* Meal card */
    .meal-card { background: #f6eed1; border-radius: 16px; overflow: hidden; }
    .meal-card-header { display: flex; justify-content: space-between; align-items: flex-start; padding: 14px; background: #f6eed1; }
    .meal-card-info   { display: flex; flex-direction: column; gap: 4px; flex: 1; }
    .meal-tag  { display: inline-flex; font-size: 10px; font-weight: 700; letter-spacing: 0.5px; padding: 3px 8px; border-radius: 6px; align-self: flex-start; }
    .meal-name { font-size: 15px; font-weight: 700; color: #1f1c0a; }
    .meal-cal  { font-size: 12px; color: #136967; font-weight: 600; }
    .meal-card-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
    .meal-time { font-size: 11px; color: #2f6648; font-weight: 600; }
    .consumed-badge { font-size: 20px; }

    .alimentos-list { padding: 0 14px 14px; display: flex; flex-direction: column; gap: 6px; }
    .alimento-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #fbf4d6; border-radius: 10px; }
    .alimento-name { font-size: 13px; color: #1f1c0a; font-weight: 500; flex: 1; }
    .alimento-gram { font-size: 12px; color: #136967; font-weight: 700; }

    .instrucciones { padding: 0 14px 14px; font-size: 13px; color: #136967; line-height: 1.5; margin: 0; font-style: italic; }

    .mark-btn { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 11px 14px; border-radius: 10px; background: #2f6648; border: none; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; margin: 0 14px 14px; }
    .mark-btn:disabled { opacity: 0.6; cursor: default; }
    .spinner-sm { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
  `],
})
export class DietaComponent implements OnInit {
  auth   = inject(AuthStore);
  router = inject(Router);
  private svc = inject(NutricionService);

  loading     = signal(true);
  activaDieta = signal<NutricionDieta | null>(null);
  menuActivo  = signal<NutricionMenu | null>(null);
  detallesAll = signal<NutricionMenuDetalle[]>([]);
  resumen     = signal<ResumenDiario | null>(null);
  selectedDay = signal(1);
  todayDiaNum  = signal(1);
  registering  = signal<number | null>(null);
  registrosHoy = signal<NutricionRegistroComida[]>([]);

  diasPresentes = computed(() => {
    return Array.from(new Set(this.detallesAll().map(d => d.dia_numero))).sort((a, b) => a - b);
  });

  detallesDia = computed(() => {
    return this.detallesAll()
      .filter(d => d.dia_numero === this.selectedDay())
      .sort((a, b) => (a.tipo_comida_id ?? 0) - (b.tipo_comida_id ?? 0));
  });

  consumidosPorDetalle = computed(() => {
    const map: Record<number, boolean> = {};
    for (const r of this.resumen()?.registros_comida ?? []) {
      if (r.menu_detalle_id && r.estado === 'C') map[r.menu_detalle_id] = true;
    }
    for (const r of this.registrosHoy()) {
      if (r.menu_detalle_id) map[r.menu_detalle_id] = true;
    }
    return map;
  });

  isConsumed(d: NutricionMenuDetalle): boolean {
    return d.state === 'C' || !!this.consumidosPorDetalle()[d.id];
  }

  tipoColor(id: number) { return TIPO_COLORS[id] ?? '#2f6648'; }
  tipoName(id: number)  { return TIPO_NAMES[id]  ?? 'COMIDA'; }
  tipoTime(id: number)  { return TIPO_TIMES[id]  ?? ''; }
  todayDia()            { return this.todayDiaNum(); }
  diaLabel(fi: string, n: number) { return diaLabel(fi, n); }

  private readonly MEAL_NAMES_MAP: Record<number, string> = { 1:'Desayuno', 2:'Media Mañana', 3:'Almuerzo', 4:'Media Tarde', 5:'Merienda / Cena' };

  registrarConsumo(detalle: NutricionMenuDetalle): void {
    if (this.registering()) return;
    this.registering.set(detalle.id);
    const pid = this.auth.pacienteId()!;
    const today = new Date().toISOString().split('T')[0];
    const payload: CrearRegistroComidaPayload = {
      fecha: today,
      tipo_comida_id: detalle.tipo_comida_id,
      menu_detalle_id: detalle.id,
      fuera_de_plan: false,
      calorias_consumidas: detalle.calorias_total ?? undefined,
      descripcion_libre: detalle.nombre_comida ?? this.MEAL_NAMES_MAP[detalle.tipo_comida_id] ?? 'Comida',
      proteinas_g: detalle.proteinas_g_total ?? undefined,
      carbohidratos_g: detalle.carbohidratos_g_total ?? undefined,
      grasas_g: detalle.grasas_g_total ?? undefined,
    };
    this.svc.crearRegistroComida(pid, payload).pipe(catchError(() => of(null))).subscribe(reg => {
      if (reg) this.registrosHoy.update(list => [...list, reg]);
      this.registering.set(null);
    });
  }

  ngOnInit(): void {
    const pid = this.auth.pacienteId();
    if (!pid) { this.loading.set(false); return; }

    const today = new Date().toISOString().split('T')[0];

    forkJoin({
      resumen:   this.svc.getResumenDiario(pid, today).pipe(catchError(() => of(null))),
      registros: this.svc.getRegistrosComida(pid, today).pipe(catchError(() => of(null))),
    }).subscribe(({ resumen, registros }) => {
      if (resumen) this.resumen.set(resumen);
      if (registros) this.registrosHoy.set(registros.data ?? []);
    });

    // Chain: dietas → menus → menu detalles
    this.svc.getDietas(pid).pipe(
      catchError(() => of(null)),
      switchMap(dietasData => {
        if (!dietasData) return of(null);
        const activa = dietasData.data.find(d => d.estado === 'ACTIVA') ?? dietasData.data[0] ?? null;
        this.activaDieta.set(activa);
        if (!activa) return of(null);
        return this.svc.getMenus(pid, activa.id).pipe(catchError(() => of(null)));
      }),
      switchMap(menusData => {
        if (!menusData) return of(null);
        const menu = menusData.data.find(m => m.estado === 'ACTIVO') ?? menusData.data[0] ?? null;
        this.menuActivo.set(menu);
        if (!menu) return of(null);
        if (menu.fecha_inicio) {
          const dia = todayDiaNumero(menu.fecha_inicio);
          this.todayDiaNum.set(dia);
          this.selectedDay.set(dia);
        }
        return this.svc.getMenu(pid, menu.id).pipe(catchError(() => of(null)));
      }),
    ).subscribe(menuFull => {
      if (menuFull?.detalles) {
        this.detallesAll.set(menuFull.detalles);
        const days = Array.from(new Set(menuFull.detalles.map(d => d.dia_numero))).sort();
        if (days.length > 0 && !days.includes(this.selectedDay())) {
          this.selectedDay.set(days[0]);
        }
      }
      this.loading.set(false);
    });
  }
}
