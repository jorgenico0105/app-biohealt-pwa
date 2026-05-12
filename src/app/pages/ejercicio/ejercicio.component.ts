import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { AuthStore } from '../../core/store/auth.store';
import { NutricionService, NutricionEjercicioPaciente, NutricionRegistroEjercicio, CrearRegistroEjercicioPayload } from '../../core/services/nutricion.service';

const NIVEL_COLOR: Record<string, string> = {
  PRINCIPIANTE: '#136967', INTERMEDIO: '#F59E0B', AVANZADO: '#F43F5E',
};

@Component({
  selector: 'app-ejercicio',
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="page">
      <div class="page-header">
        <h2 class="page-title">Ejercicio</h2>
        <button class="add-btn" (click)="showLogModal.set(true)">
          <ion-icon name="add"></ion-icon>
          Registrar
        </button>
      </div>

      @if (loading()) {
        <div class="loading-wrap"><div class="spinner"></div></div>
      }

      <!-- Resumen del día -->
      @if (registrosHoy().length > 0) {
        <div class="card">
          <h3 class="section-title">Ejercicios de hoy</h3>
          @for (r of registrosHoy(); track r.id) {
            <div class="registro-row">
              <div class="registro-icon"><ion-icon name="barbell-outline"></ion-icon></div>
              <div class="registro-info">
                <span class="registro-name">{{ r.nombre_libre ?? 'Ejercicio' }}</span>
                <span class="registro-detail">
                  {{ r.duracion_min_real ? r.duracion_min_real + ' min' : '' }}
                  {{ r.calorias_quemadas ? '· ' + r.calorias_quemadas + ' kcal quemadas' : '' }}
                </span>
              </div>
              @if (r.nivel_esfuerzo) {
                <span class="esfuerzo-badge" [style.background]="esfuerzoColor(r.nivel_esfuerzo)">
                  {{ r.nivel_esfuerzo }}/10
                </span>
              }
            </div>
          }
        </div>
      }

      <!-- Ejercicios asignados -->
      @if (ejerciciosAsignados().length > 0) {
        <div class="card">
          <h3 class="section-title">Rutina asignada</h3>
          @for (e of ejerciciosAsignados(); track e.id) {
            <div class="ejercicio-card" (click)="selectForLog(e)">
              <div class="ejercicio-icon-wrap" [style.background]="nivelColor(e.ejercicio?.nivel) + '18'">
                <ion-icon name="fitness-outline" [style.color]="nivelColor(e.ejercicio?.nivel)"></ion-icon>
              </div>
              <div class="ejercicio-info">
                <span class="ejercicio-name">{{ e.ejercicio?.nombre ?? 'Ejercicio' }}</span>
                <span class="ejercicio-meta">
                  @if (e.dia_semana) { {{ e.dia_semana }} · }
                  @if (e.duracion_min) { {{ e.duracion_min }} min · }
                  @if (e.series && e.repeticiones) { {{ e.series }}x{{ e.repeticiones }} }
                </span>
                @if (e.ejercicio?.grupo_muscular) {
                  <span class="ejercicio-grupo">{{ e.ejercicio!.grupo_muscular }}</span>
                }
              </div>
              @if (e.calorias_estimadas) {
                <span class="ejercicio-cal">~{{ e.calorias_estimadas }} kcal</span>
              }
            </div>
          }
        </div>
      }

      @if (!loading() && ejerciciosAsignados().length === 0 && registrosHoy().length === 0) {
        <div class="card empty-card">
          <ion-icon name="fitness-outline" style="font-size:48px;color:#2f6648;opacity:0.5"></ion-icon>
          <p style="color:#2f6648;font-size:15px;font-weight:600;text-align:center;margin:0">Sin rutina asignada</p>
          <p style="color:#136967;font-size:13px;text-align:center;margin:0">Tu médico aún no asignó ejercicios. Podés registrar ejercicio libre.</p>
          <button class="add-btn" style="align-self:center" (click)="showLogModal.set(true)">
            <ion-icon name="add"></ion-icon> Registrar ejercicio libre
          </button>
        </div>
      }
    </div>

    <!-- Log modal -->
    @if (showLogModal()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="modal-title">Registrar ejercicio</h3>
            <button class="modal-close" (click)="closeModal()"><ion-icon name="close"></ion-icon></button>
          </div>

          <div class="modal-body">
            @if (selectedEjercicio()) {
              <div class="selected-badge">
                <ion-icon name="fitness-outline"></ion-icon>
                <span>{{ selectedEjercicio()!.ejercicio?.nombre }}</span>
                <button (click)="selectedEjercicio.set(null)" style="background:transparent;border:none;cursor:pointer;color:#2f6648"><ion-icon name="close-circle-outline"></ion-icon></button>
              </div>
            } @else {
              <div class="field-group">
                <label class="field-label">Nombre (libre)</label>
                <input class="field-input" type="text" [(ngModel)]="logForm.nombre_libre" placeholder="Ej: Caminata, Natación..." />
              </div>
            }

            <div class="form-row">
              <div class="field-group">
                <label class="field-label">Duración (min)</label>
                <input class="field-input" type="number" [(ngModel)]="logForm.duracion_min_real" placeholder="0" />
              </div>
              <div class="field-group">
                <label class="field-label">Esfuerzo (1-10)</label>
                <input class="field-input" type="number" [(ngModel)]="logForm.nivel_esfuerzo" placeholder="5" min="1" max="10" />
              </div>
            </div>

            <div class="form-row">
              <div class="field-group">
                <label class="field-label">Calorías quemadas</label>
                <input class="field-input" type="number" [(ngModel)]="logForm.calorias_quemadas" placeholder="0" />
              </div>
              <div class="field-group">
                <label class="field-label">FC máx (bpm)</label>
                <input class="field-input" type="number" [(ngModel)]="logForm.frecuencia_cardiaca_max" placeholder="0" />
              </div>
            </div>

            <div class="field-group">
              <label class="field-label">Notas</label>
              <textarea class="field-input" [(ngModel)]="logForm.notas" placeholder="Observaciones..." rows="2"></textarea>
            </div>

            @if (logError()) { <p class="error-text">{{ logError() }}</p> }
          </div>

          <div class="modal-footer">
            <button class="btn-secondary" (click)="closeModal()">Cancelar</button>
            <button class="btn-primary" (click)="submitLog()" [disabled]="logLoading()">
              @if (logLoading()) { <span class="spinner-sm"></span> }
              @else { Guardar }
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { padding: 16px 16px 24px; display: flex; flex-direction: column; gap: 14px; background: #fff9ea; min-height: 100%; }
    .page-header { display: flex; justify-content: space-between; align-items: center; }
    .page-title  { font-size: 22px; font-weight: 800; color: #1f1c0a; margin: 0; }
    .add-btn { display: flex; align-items: center; gap: 6px; background: #2f6648; color: #fff; border: none; border-radius: 12px; padding: 8px 14px; font-size: 13px; font-weight: 700; cursor: pointer; }

    .loading-wrap { display: flex; justify-content: center; padding: 48px 0; }
    .spinner { width: 28px; height: 28px; border: 3px solid rgba(47,102,72,0.2); border-top-color: #2f6648; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .card { background: #f6eed1; border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .empty-card { align-items: center; padding: 32px 16px; gap: 12px; }
    .section-title { font-size: 16px; font-weight: 700; color: #1f1c0a; margin: 0; }

    .registro-row { display: flex; align-items: center; gap: 12px; padding: 10px; background: #fbf4d6; border-radius: 12px; }
    .registro-icon { width: 38px; height: 38px; border-radius: 10px; background: rgba(244,63,94,0.1); display: flex; align-items: center; justify-content: center; font-size: 18px; color: #F43F5E; flex-shrink: 0; }
    .registro-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .registro-name { font-size: 14px; font-weight: 700; color: #1f1c0a; }
    .registro-detail { font-size: 12px; color: #136967; }
    .esfuerzo-badge { padding: 3px 8px; border-radius: 8px; font-size: 11px; font-weight: 700; color: #fff; flex-shrink: 0; }

    .ejercicio-card { display: flex; align-items: center; gap: 12px; padding: 12px; background: #fbf4d6; border-radius: 12px; cursor: pointer; }
    .ejercicio-icon-wrap { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
    .ejercicio-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .ejercicio-name { font-size: 14px; font-weight: 700; color: #1f1c0a; }
    .ejercicio-meta { font-size: 12px; color: #136967; }
    .ejercicio-grupo { font-size: 11px; font-weight: 600; color: #136967; background: rgba(19,105,103,0.1); padding: 2px 7px; border-radius: 6px; align-self: flex-start; }
    .ejercicio-cal  { font-size: 13px; font-weight: 700; color: #2f6648; flex-shrink: 0; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: flex-end; z-index: 50; }
    .modal { background: #fff9ea; border-radius: 24px 24px 0 0; width: 100%; max-height: 85dvh; display: flex; flex-direction: column; padding-bottom: env(safe-area-inset-bottom, 16px); }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 20px 16px; }
    .modal-title  { font-size: 18px; font-weight: 800; color: #1f1c0a; margin: 0; }
    .modal-close  { background: #f6eed1; border: none; border-radius: 10px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #2f6648; cursor: pointer; }
    .modal-body   { flex: 1; overflow-y: auto; padding: 0 20px; display: flex; flex-direction: column; gap: 14px; }
    .modal-footer { display: flex; gap: 10px; padding: 16px 20px; }

    .selected-badge { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: rgba(47,102,72,0.1); border-radius: 12px; font-size: 14px; font-weight: 600; color: #2f6648; }
    .field-group { display: flex; flex-direction: column; gap: 6px; flex: 1; }
    .field-label { font-size: 12px; font-weight: 600; color: #2f6648; }
    .field-input { background: #f6eed1; border: 1.5px solid rgba(47,102,72,0.2); border-radius: 12px; padding: 10px 14px; font-size: 14px; color: #1f1c0a; width: 100%; box-sizing: border-box; font-family: inherit; outline: none; resize: none; }
    .field-input:focus { border-color: #2f6648; }
    .form-row { display: flex; gap: 12px; }

    .btn-primary   { flex: 2; background: #2f6648; color: #fff; border: none; border-radius: 14px; padding: 14px; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; }
    .btn-primary:disabled { opacity: 0.6; }
    .btn-secondary { flex: 1; background: #f6eed1; color: #2f6648; border: none; border-radius: 14px; padding: 14px; font-size: 15px; font-weight: 600; cursor: pointer; }
    .spinner-sm { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }

    .error-text { color: #ba1a1a; font-size: 13px; margin: 0; }
  `],
})
export class EjercicioComponent implements OnInit {
  auth   = inject(AuthStore);
  private svc = inject(NutricionService);

  loading   = signal(true);
  ejerciciosAsignados = signal<NutricionEjercicioPaciente[]>([]);
  registrosHoy        = signal<NutricionRegistroEjercicio[]>([]);

  showLogModal      = signal(false);
  selectedEjercicio = signal<NutricionEjercicioPaciente | null>(null);
  logLoading        = signal(false);
  logError          = signal('');

  logForm: Partial<CrearRegistroEjercicioPayload> = {
    fecha: new Date().toISOString().split('T')[0],
    nombre_libre: '',
    duracion_min_real: undefined,
    nivel_esfuerzo: undefined,
    calorias_quemadas: undefined,
    frecuencia_cardiaca_max: undefined,
    notas: '',
  };

  nivelColor(nivel?: string): string { return nivel ? (NIVEL_COLOR[nivel.toUpperCase()] ?? '#2f6648') : '#2f6648'; }
  esfuerzoColor(n: number): string { return n <= 3 ? '#136967' : n <= 6 ? '#F59E0B' : '#F43F5E'; }

  selectForLog(e: NutricionEjercicioPaciente): void {
    this.selectedEjercicio.set(e);
    this.logForm = { fecha: new Date().toISOString().split('T')[0], ejercicio_paciente_id: e.id, duracion_min_real: e.duracion_min };
    this.showLogModal.set(true);
  }

  closeModal(): void {
    this.showLogModal.set(false);
    this.selectedEjercicio.set(null);
    this.logError.set('');
    this.logForm = { fecha: new Date().toISOString().split('T')[0], nombre_libre: '' };
  }

  submitLog(): void {
    const pid = this.auth.pacienteId();
    if (!pid) return;
    const payload: CrearRegistroEjercicioPayload = {
      fecha: this.logForm.fecha ?? new Date().toISOString().split('T')[0],
      ejercicio_paciente_id: this.selectedEjercicio()?.id,
      nombre_libre: this.logForm.nombre_libre,
      duracion_min_real: this.logForm.duracion_min_real,
      nivel_esfuerzo: this.logForm.nivel_esfuerzo,
      calorias_quemadas: this.logForm.calorias_quemadas,
      frecuencia_cardiaca_max: this.logForm.frecuencia_cardiaca_max,
      notas: this.logForm.notas,
    };
    this.logLoading.set(true);
    this.svc.crearRegistroEjercicio(pid, payload).pipe(catchError(() => of(null))).subscribe(r => {
      this.logLoading.set(false);
      if (r) {
        this.closeModal();
        this.loadRegistros(pid);
      } else {
        this.logError.set('Error al registrar. Intenta de nuevo.');
      }
    });
  }

  ngOnInit(): void {
    const pid = this.auth.pacienteId();
    if (!pid) { this.loading.set(false); return; }
    this.loadData(pid);
  }

  private loadData(pid: number): void {
    this.svc.getEjerciciosAsignados(pid).pipe(catchError(() => of(null))).subscribe(r => {
      if (r) this.ejerciciosAsignados.set(r.data);
      this.loading.set(false);
    });
    this.loadRegistros(pid);
  }

  private loadRegistros(pid: number): void {
    const today = new Date().toISOString().split('T')[0];
    this.svc.getRegistrosEjercicio(pid).pipe(catchError(() => of(null))).subscribe(r => {
      if (r) {
        this.registrosHoy.set(r.data.filter(e => e.fecha?.startsWith(today)));
      }
    });
  }
}
