import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of, forkJoin, switchMap } from 'rxjs';
import { AuthStore } from '../../core/store/auth.store';
import {
  NutricionService, NutricionMenu, NutricionMenuDetalle,
  NutricionRegistroComida, CrearRegistroComidaPayload,
} from '../../core/services/nutricion.service';

const SHORT_DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const MEAL_NAMES: Record<number, string> = { 1:'Desayuno', 2:'Media Mañana', 3:'Almuerzo', 4:'Media Tarde', 5:'Merienda / Cena' };
const MEAL_ICONS: Record<number, string> = { 1:'sunny-outline', 2:'cafe-outline', 3:'restaurant-outline', 4:'nutrition-outline', 5:'moon-outline' };

function diaLabel(fechaInicio: string, diaNumero: number): string {
  const [y,m,d] = fechaInicio.substring(0,10).split('-').map(Number);
  const date = new Date(y, m-1, d + diaNumero - 1);
  return SHORT_DAYS[date.getDay()];
}

function todayDiaNumero(fechaInicio: string): number {
  const [y,m,d] = fechaInicio.substring(0,10).split('-').map(Number);
  const start = new Date(y, m-1, d);
  const now   = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today.getTime() - start.getTime()) / 86_400_000) + 1;
}

function autoTipoComida(): number {
  const h = new Date().getHours();
  if (h < 10) return 1; if (h < 12) return 2; if (h < 15) return 3; if (h < 18) return 4; return 5;
}

@Component({
  selector: 'app-registro',
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="page">
      <h2 class="page-title">Registrar Comida</h2>

      @if (menuFull()) {
        <div class="menu-tag">
          <ion-icon name="leaf-outline" style="font-size:14px;color:#2f6648"></ion-icon>
          <span>{{ menuFull()!.nombre ?? ('Semana ' + menuFull()!.semana_numero) }}</span>
        </div>
      }

      <!-- Day selector -->
      @if (availableDays().length > 0) {
        <div class="day-row">
          @for (dia of availableDays(); track dia) {
            <button class="day-btn"
              [style.background]="selDia() === dia ? '#2f6648' : '#f6eed1'"
              [style.border-color]="isToday(dia) && selDia() !== dia ? '#2f6648' : 'transparent'"
              [style.border-width]="isToday(dia) && selDia() !== dia ? '1.5px' : '0'"
              (click)="selDia.set(dia)">
              <span [style.color]="selDia() === dia ? '#fff' : '#136967'" style="font-size:13px;font-weight:700">{{ dayLabel(dia) }}</span>
              @if (isToday(dia)) { <span class="today-dot" [style.background]="selDia() === dia ? '#fff' : '#2f6648'"></span> }
            </button>
          }
        </div>
      }

      @if (loading()) {
        <div class="loading-wrap"><div class="spinner"></div></div>
      }

      @if (!loading() && !activaDieta()) {
        <div class="empty-card">
          <ion-icon name="leaf-outline" style="font-size:32px;color:#136967;opacity:0.5"></ion-icon>
          <p>No tenés una dieta activa asignada.</p>
        </div>
      }

      <!-- Meals for selected day -->
      @for (detalle of detallesForDay(); track detalle.id) {
        <div class="meal-card" [style.border-color]="isRegistered(detalle) ? 'rgba(47,102,72,0.5)' : 'rgba(47,102,72,0.1)'" [style.border-width]="isRegistered(detalle) ? '1.5px' : '1px'">
          <div class="meal-header">
            <div class="meal-icon-wrap">
              <ion-icon [name]="MEAL_ICONS[detalle.tipo_comida_id] ?? 'fast-food-outline'" style="font-size:20px;color:#2f6648"></ion-icon>
            </div>
            <div class="meal-header-info">
              <span class="meal-name">{{ MEAL_NAMES[detalle.tipo_comida_id] ?? detalle.nombre_comida ?? ('Comida ' + detalle.tipo_comida_id) }}</span>
              @if (detalle.calorias_total != null) { <span class="meal-kcal">{{ detalle.calorias_total }} kcal</span> }
            </div>
            @if (isRegistered(detalle)) {
              <div class="done-badge"><ion-icon name="checkmark-circle" style="font-size:14px;color:#2f6648"></ion-icon> <span>Listo</span></div>
            }
          </div>
          @for (a of (detalle.alimentos ?? []); track a.id) {
            <div class="food-row">
              <span class="food-dot"></span>
              <span class="food-name">{{ a.Alimento?.nombre ?? ('Alimento ' + a.alimento_id) }}</span>
              <span class="food-gr">{{ a.gramos_asignados }}g</span>
              @if (a.calorias_calc != null) { <span class="food-cal">{{ a.calorias_calc | number:'1.0-0' }} kcal</span> }
            </div>
          }
          @if (!isRegistered(detalle) && selDia() === todayDia()) {
            <button class="mark-btn" [disabled]="registering() === detalle.id" (click)="registerPlan(detalle)">
              @if (registering() === detalle.id) { <div class="spinner-sm"></div> }
              @else { <ion-icon name="checkmark-outline" style="font-size:16px;color:#fff"></ion-icon> }
              Marcar consumida
            </button>
          }
        </div>
      }

      @if (!loading() && activeMenu() && detallesForDay().length === 0) {
        <div class="empty-card">
          <ion-icon name="today-outline" style="font-size:28px;color:#136967;opacity:0.5"></ion-icon>
          <p>Sin comidas planificadas para este día.</p>
        </div>
      }

      <!-- Extra food -->
      <div class="divider"></div>
      <h3 class="section-title">Agregar alimento extra</h3>
      <p class="section-sub">Alimento que consumiste fuera del plan</p>

      <div class="free-card">
        <label class="free-label">Nombre del alimento</label>
        <input class="free-input" type="text" placeholder="Ej: Manzana, Arroz con pollo..." [(ngModel)]="libreNombre" />

        <label class="free-label">Calorías (opcional)</label>
        <input class="free-input" type="number" placeholder="Ej: 120" [(ngModel)]="libreCalorias" />

        <button class="free-btn" [disabled]="libreAdding() || !libreNombre.trim()" [style.background]="libreNombre.trim() ? '#2f6648' : '#f6eed1'" (click)="registrarLibre()">
          @if (libreAdding()) { <div class="spinner-sm"></div> }
          @else { <ion-icon name="add-circle-outline" [style.color]="libreNombre.trim() ? '#fff' : '#136967'"></ion-icon> }
          <span [style.color]="libreNombre.trim() ? '#fff' : '#136967'">Agregar alimento</span>
        </button>
      </div>

      <!-- Today's extra registros -->
      @if (extrasHoy().length > 0) {
        <div class="free-card">
          <h3 class="section-title">Extras de hoy</h3>
          @for (r of extrasHoy(); track r.id) {
            <div class="log-row">
              <span class="log-dot"></span>
              <span class="log-name">{{ r.descripcion_libre ?? MEAL_NAMES[r.tipo_comida_id] }}</span>
              @if (r.calorias_consumidas != null) { <span class="log-cal">{{ r.calorias_consumidas }} kcal</span> }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 16px 16px 40px; display: flex; flex-direction: column; gap: 12px; background: #fff9ea; min-height: 100%; }
    .page-title { font-size: 24px; font-weight: 800; color: #1f1c0a; margin: 0; }
    .menu-tag { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 10px; background: #f6eed1; align-self: flex-start; font-size: 13px; font-weight: 600; color: #136967; }

    .day-row { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding: 4px 0; }
    .day-row::-webkit-scrollbar { display: none; }
    .day-btn { width: 52px; height: 52px; border-radius: 14px; border: 1.5px solid transparent; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; cursor: pointer; flex-shrink: 0; font-family: inherit; }
    .today-dot { width: 5px; height: 5px; border-radius: 3px; }

    .loading-wrap { display: flex; justify-content: center; padding: 32px; }
    .spinner { width: 28px; height: 28px; border: 3px solid rgba(47,102,72,0.2); border-top-color: #2f6648; border-radius: 50%; animation: spin 0.7s linear infinite; }

    .empty-card { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px 16px; border-radius: 16px; background: #f6eed1; }
    .empty-card p { font-size: 14px; color: #136967; text-align: center; margin: 0; }

    .meal-card { background: #f6eed1; border-radius: 16px; padding: 14px; display: flex; flex-direction: column; gap: 8px; border-style: solid; }
    .meal-header { display: flex; align-items: center; gap: 10px; }
    .meal-icon-wrap { width: 40px; height: 40px; border-radius: 12px; background: rgba(47,102,72,0.1); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .meal-header-info { flex: 1; }
    .meal-name { display: block; font-size: 15px; font-weight: 700; color: #1f1c0a; }
    .meal-kcal { display: block; font-size: 12px; color: #136967; margin-top: 1px; }
    .done-badge { display: flex; align-items: center; gap: 4px; padding: 4px 8px; border-radius: 20px; background: rgba(47,102,72,0.1); font-size: 11px; font-weight: 700; color: #2f6648; }

    .food-row { display: flex; align-items: center; gap: 8px; }
    .food-dot { width: 5px; height: 5px; border-radius: 3px; background: #2f6648; flex-shrink: 0; }
    .food-name { flex: 1; font-size: 13px; color: #1f1c0a; }
    .food-gr   { font-size: 12px; color: #136967; }
    .food-cal  { font-size: 12px; font-weight: 600; color: #136967; min-width: 52px; text-align: right; }

    .mark-btn { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 11px; border-radius: 10px; background: #2f6648; border: none; color: #fff; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; margin-top: 4px; }
    .mark-btn:disabled { opacity: 0.6; cursor: default; }

    .divider { height: 1px; background: rgba(47,102,72,0.12); border-radius: 1px; margin: 4px 0; }
    .section-title { font-size: 16px; font-weight: 700; color: #1f1c0a; margin: 0; }
    .section-sub   { font-size: 12px; color: #136967; margin: -6px 0 0; }

    .free-card  { background: #f6eed1; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .free-label { font-size: 12px; font-weight: 600; color: #136967; }
    .free-input { background: rgba(47,102,72,0.06); border: 1.5px solid transparent; border-radius: 12px; padding: 12px; font-size: 14px; color: #1f1c0a; font-family: inherit; outline: none; }
    .free-input:focus { border-color: #2f6648; }
    .free-btn   { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; border-radius: 12px; border: none; font-size: 14px; font-weight: 700; cursor: pointer; font-family: inherit; }
    .free-btn:disabled { opacity: 0.6; cursor: default; }

    .log-row { display: flex; align-items: center; gap: 10px; padding: 10px 0; border-bottom: 1px solid rgba(47,102,72,0.1); }
    .log-dot  { width: 7px; height: 7px; border-radius: 4px; background: #d97706; flex-shrink: 0; }
    .log-name { flex: 1; font-size: 13px; color: #1f1c0a; }
    .log-cal  { font-size: 12px; color: #136967; }

    .spinner-sm { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class RegistroComponent implements OnInit {
  auth = inject(AuthStore);
  private nutricionSvc = inject(NutricionService);

  MEAL_NAMES = MEAL_NAMES;
  MEAL_ICONS = MEAL_ICONS;

  loading       = signal(true);
  registering   = signal<number | null>(null);
  libreAdding   = signal(false);

  activaDieta   = signal<any>(null);
  activeMenu    = signal<NutricionMenu | null>(null);
  menuFull      = signal<NutricionMenu | null>(null);
  registrosHoy  = signal<NutricionRegistroComida[]>([]);

  selDia        = signal(1);
  private _todayDia = 1;

  libreNombre   = '';
  libreCalorias = '';

  today = new Date().toISOString().split('T')[0];

  todayDia = () => this._todayDia;

  availableDays = computed(() => Array.from(new Set((this.menuFull()?.detalles ?? []).map(d => d.dia_numero))).sort((a,b)=>a-b));

  detallesForDay = computed(() =>
    (this.menuFull()?.detalles ?? []).filter(d => d.dia_numero === this.selDia()).sort((a,b) => a.tipo_comida_id - b.tipo_comida_id)
  );

  extrasHoy = computed(() => this.registrosHoy().filter(r => r.fuera_de_plan));

  isRegistered(detalle: NutricionMenuDetalle): boolean {
    return detalle.state === 'C' || this.registrosHoy().some(r => r.menu_detalle_id === detalle.id);
  }

  isToday(dia: number): boolean { return dia === this._todayDia; }

  dayLabel(dia: number): string {
    const menu = this.menuFull();
    return menu?.fecha_inicio ? diaLabel(menu.fecha_inicio, dia) : `D${dia}`;
  }

  ngOnInit(): void {
    const pid = this.auth.pacienteId();
    if (!pid) { this.loading.set(false); return; }

    forkJoin({
      dietas:   this.nutricionSvc.getDietas(pid).pipe(catchError(() => of({ data: [] } as any))),
      registros:this.nutricionSvc.getRegistrosComida(pid, this.today).pipe(catchError(() => of({ data: [] } as any))),
    }).pipe(
      switchMap(({ dietas, registros }) => {
        this.registrosHoy.set(registros.data ?? []);
        const activa = (dietas.data ?? []).find((d: any) => d.estado === 'ACTIVA');
        this.activaDieta.set(activa ?? null);
        if (!activa) { this.loading.set(false); return of(null); }
        return this.nutricionSvc.getMenus(pid, activa.id).pipe(catchError(() => of({ data: [] } as any)));
      }),
      switchMap(menusResp => {
        if (!menusResp) return of(null);
        const active = (menusResp.data ?? []).find((m: any) => m.estado === 'ACTIVO') ?? menusResp.data?.[0];
        this.activeMenu.set(active ?? null);
        if (!active) { this.loading.set(false); return of(null); }
        if (active.fecha_inicio) {
          this._todayDia = todayDiaNumero(active.fecha_inicio);
          this.selDia.set(this._todayDia);
        }
        return this.nutricionSvc.getMenu(pid, active.id).pipe(catchError(() => of(null)));
      })
    ).subscribe(menuFull => {
      this.menuFull.set(menuFull as NutricionMenu | null);
      this.loading.set(false);
    });
  }

  registerPlan(detalle: NutricionMenuDetalle): void {
    if (this.registering()) return;
    this.registering.set(detalle.id);
    const pid = this.auth.pacienteId()!;
    const payload: CrearRegistroComidaPayload = {
      fecha: this.today,
      tipo_comida_id: detalle.tipo_comida_id,
      menu_detalle_id: detalle.id,
      fuera_de_plan: false,
      calorias_consumidas: detalle.calorias_total,
      descripcion_libre: detalle.nombre_comida ?? MEAL_NAMES[detalle.tipo_comida_id],
      proteinas_g: detalle.proteinas_g_total,
      carbohidratos_g: detalle.carbohidratos_g_total,
      grasas_g: detalle.grasas_g_total,
    };
    this.nutricionSvc.crearRegistroComida(pid, payload).pipe(catchError(() => of(null))).subscribe(reg => {
      if (reg) {
        this.registrosHoy.update(list => [...list, reg]);
        this.menuFull.update(m => {
          if (!m) return m;
          return { ...m, detalles: m.detalles?.map(d => d.id === detalle.id ? { ...d, state: 'C' } : d) };
        });
      }
      this.registering.set(null);
    });
  }

  registrarLibre(): void {
    if (!this.libreNombre.trim() || this.libreAdding()) return;
    this.libreAdding.set(true);
    const pid = this.auth.pacienteId()!;
    const payload: CrearRegistroComidaPayload = {
      fecha: this.today,
      tipo_comida_id: autoTipoComida(),
      fuera_de_plan: true,
      descripcion_libre: this.libreNombre.trim(),
      calorias_consumidas: this.libreCalorias ? parseFloat(this.libreCalorias) : undefined,
    };
    this.nutricionSvc.crearRegistroComida(pid, payload).pipe(catchError(() => of(null))).subscribe(reg => {
      if (reg) {
        this.registrosHoy.update(list => [...list, reg]);
        this.libreNombre = '';
        this.libreCalorias = '';
      }
      this.libreAdding.set(false);
    });
  }
}
