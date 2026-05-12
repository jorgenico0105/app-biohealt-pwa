import { Component, CUSTOM_ELEMENTS_SCHEMA, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { AuthStore } from '../../core/store/auth.store';
import { NutricionService, TipoSintoma } from '../../core/services/nutricion.service';

interface SymptomType {
  label: string;
  icon: string;
  color: string;
  tipo?: TipoSintoma;
}

const SYMPTOM_TYPES: SymptomType[] = [
  { label: 'Gastrointestinal', icon: 'alert-circle-outline', color: '#136967',  tipo: 'GASTROINTESTINAL' },
  { label: 'Energético',       icon: 'battery-half-outline', color: '#d97706',  tipo: 'ENERGETICO' },
  { label: 'Digestivo',        icon: 'body-outline',         color: '#8B5CF6',  tipo: 'DIGESTIVO' },
  { label: 'Otro',             icon: 'add-circle-outline',   color: '#6B7280',  tipo: 'OTRO' },
  { label: 'Dolor cabeza',     icon: 'medical-outline',      color: '#f43f5e' },
  { label: 'Fatiga',           icon: 'bed-outline',          color: '#d97706' },
  { label: 'Mareos',           icon: 'sync-circle-outline',  color: '#38bdf8' },
  { label: 'Insomnio',         icon: 'moon-outline',         color: '#6366F1' },
];

const SEVERITY_LABELS: Record<number, string> = { 1: 'Muy leve', 2: 'Leve', 3: 'Moderado', 4: 'Intenso', 5: 'Severo' };
const SEVERITY_COLORS: Record<number, string> = { 1: '#2f6648', 2: '#48805f', 3: '#f59e0b', 4: '#f97316', 5: '#f43f5e' };

@Component({
  selector: 'app-sintomas',
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="page">
      <!-- Header -->
      <h2 class="page-title">Registrar Síntoma</h2>

      <!-- Date -->
      <div class="date-row">
        <ion-icon name="calendar-outline" style="font-size:16px;color:#136967"></ion-icon>
        <span class="date-text">{{ dateLabel }}</span>
      </div>

      <!-- Symptom types -->
      <div class="card">
        <h3 class="card-title">¿Qué síntoma tenés?</h3>
        <p class="card-sub">Seleccioná el que más se ajusta</p>
        <div class="symptoms-grid">
          @for (sym of symptoms; track sym.label; let idx = $index) {
            <button class="sym-card" [class.selected]="selectedSym()?.label === sym.label" [style.background]="selectedSym()?.label === sym.label ? sym.color + '14' : '#fff9ea'" [style.border-color]="selectedSym()?.label === sym.label ? sym.color + '50' : 'transparent'" (click)="selectedSym.set(sym)">
              <div class="sym-icon" [style.background]="sym.color + '20'">
                <ion-icon [name]="sym.icon" [style.color]="sym.color" style="font-size:22px"></ion-icon>
              </div>
              <span class="sym-label" [style.color]="selectedSym()?.label === sym.label ? sym.color : '#136967'">{{ sym.label }}</span>
              @if (selectedSym()?.label === sym.label) {
                <div class="sym-check" [style.background]="sym.color"><ion-icon name="checkmark" style="font-size:10px;color:#fff"></ion-icon></div>
              }
            </button>
          }
        </div>
      </div>

      <!-- Severity -->
      <div class="card">
        <div class="card-header-row">
          <h3 class="card-title">Intensidad</h3>
          <span class="sev-label" [style.color]="sevColor()">{{ SEVERITY_LABELS[severity()] }}</span>
        </div>
        <div class="sev-row">
          @for (n of [1,2,3,4,5]; track n) {
            <button class="sev-btn" [style.background]="severity() >= n ? SEVERITY_COLORS[n] : '#f6eed1'" [style.transform]="severity() === n ? 'scale(1.15)' : 'scale(1)'" (click)="severity.set(n)">
              <span [style.color]="severity() >= n ? '#fff' : '#136967'">{{ n }}</span>
            </button>
          }
        </div>
        <div class="sev-hints">
          <span>Muy leve</span><span>Severo</span>
        </div>
      </div>

      <!-- Notes -->
      <div class="card">
        <h3 class="card-title">Descripción</h3>
        <textarea class="notes-input" rows="4" placeholder="Descripción, duración, posible causa..." [(ngModel)]="notes"></textarea>
      </div>

      <!-- Save -->
      @if (lastError()) {
        <div class="error-banner">
          <ion-icon name="alert-circle-outline"></ion-icon>
          <span>{{ lastError() }}</span>
        </div>
      }

      <button class="save-btn" [class.success]="submitted()" [disabled]="saving()" [style.background]="submitted() ? '#48805f' : selectedSym() ? '#2f6648' : '#f6eed1'" (click)="guardar()">
        @if (saving()) { <div class="spinner-sm"></div> }
        @else { <ion-icon [name]="submitted() ? 'checkmark-circle' : 'save-outline'" [style.color]="selectedSym() || submitted() ? '#fff' : '#136967'"></ion-icon> }
        <span [style.color]="selectedSym() || submitted() ? '#fff' : '#136967'">
          {{ saving() ? 'Guardando...' : submitted() ? '¡Síntoma registrado!' : 'Guardar síntoma' }}
        </span>
      </button>
    </div>
  `,
  styles: [`
    .page { padding: 16px 16px 40px; display: flex; flex-direction: column; gap: 14px; background: #fff9ea; min-height: 100%; }
    .page-title { font-size: 22px; font-weight: 800; color: #1f1c0a; margin: 0; }

    .date-row { display: flex; align-items: center; gap: 8px; padding: 12px; border-radius: 12px; background: #f6eed1; }
    .date-text { font-size: 13px; font-weight: 500; color: #136967; text-transform: capitalize; }

    .card { background: #f6eed1; border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .card-header-row { display: flex; justify-content: space-between; align-items: center; }
    .card-title { font-size: 16px; font-weight: 700; color: #1f1c0a; margin: 0; }
    .card-sub   { font-size: 12px; color: #136967; margin: -8px 0 0; }

    .symptoms-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .sym-card { width: calc(25% - 6px); display: flex; flex-direction: column; align-items: center; padding: 10px 6px; border-radius: 14px; border: 1.5px solid; gap: 6px; position: relative; cursor: pointer; background: transparent; font-family: inherit; }
    .sym-icon { width: 46px; height: 46px; border-radius: 14px; display: flex; align-items: center; justify-content: center; }
    .sym-label { font-size: 10px; font-weight: 600; text-align: center; line-height: 1.3; }
    .sym-check { position: absolute; top: 6px; right: 6px; width: 16px; height: 16px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }

    .sev-label { font-size: 14px; font-weight: 700; }
    .sev-row   { display: flex; gap: 8px; justify-content: center; }
    .sev-btn   { width: 52px; height: 52px; border-radius: 14px; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.15s; }
    .sev-btn span { font-size: 18px; font-weight: 800; }
    .sev-hints { display: flex; justify-content: space-between; font-size: 11px; color: #136967; }

    .notes-input { background: rgba(47,102,72,0.06); border: 1.5px solid transparent; border-radius: 12px; padding: 12px; font-size: 14px; color: #1f1c0a; font-family: inherit; resize: none; outline: none; }
    .notes-input:focus { border-color: #2f6648; }

    .error-banner { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-radius: 14px; background: rgba(186,26,26,0.08); border: 1px solid rgba(186,26,26,0.2); font-size: 13px; color: #ba1a1a; }

    .save-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 16px; border-radius: 14px; border: none; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; transition: background 0.2s; }
    .save-btn:disabled { opacity: 0.7; cursor: default; }
    .spinner-sm { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class SintomasComponent {
  auth = inject(AuthStore);
  private nutricionSvc = inject(NutricionService);

  symptoms = SYMPTOM_TYPES;
  SEVERITY_LABELS = SEVERITY_LABELS;
  SEVERITY_COLORS = SEVERITY_COLORS;

  selectedSym = signal<SymptomType | null>(null);
  severity    = signal(2);
  notes       = '';
  saving      = signal(false);
  submitted   = signal(false);
  lastError   = signal<string | null>(null);

  sevColor = () => SEVERITY_COLORS[this.severity()];

  dateLabel = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  guardar(): void {
    if (!this.selectedSym() || this.saving()) return;
    this.saving.set(true);
    this.lastError.set(null);
    const pid = this.auth.pacienteId()!;
    const today = new Date().toISOString().split('T')[0];
    const sym = this.selectedSym()!;
    this.nutricionSvc.crearSintoma(pid, {
      fecha: today,
      tipo: sym.tipo,
      descripcion: sym.label + (this.notes ? ` — ${this.notes}` : ''),
      intensidad: this.severity() * 2,
    }).pipe(catchError(() => of(null))).subscribe(res => {
      this.saving.set(false);
      if (res) {
        this.submitted.set(true);
        setTimeout(() => {
          this.submitted.set(false);
          this.selectedSym.set(null);
          this.severity.set(2);
          this.notes = '';
        }, 1500);
      } else {
        this.lastError.set('No se pudo guardar el síntoma. Intentá de nuevo.');
      }
    });
  }
}
