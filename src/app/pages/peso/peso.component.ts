import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { AuthStore } from '../../core/store/auth.store';
import { NutricionService, NutricionProgreso, CrearProgresoPayload } from '../../core/services/nutricion.service';

function imcLabel(imc: number): string {
  if (imc < 18.5) return 'Bajo peso';
  if (imc < 25)   return 'Normal';
  if (imc < 30)   return 'Sobrepeso';
  return 'Obesidad';
}

const ENERGY_LABELS = ['', 'Muy bajo', 'Bajo', 'Normal', 'Bueno', 'Excelente'];
const ENERGY_COLORS = ['', '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981'];

@Component({
  selector: 'app-peso',
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="page">
      <h2 class="page-title">Mi Peso</h2>

      <!-- Hero -->
      <div class="hero">
        <span class="hero-label">PESO ACTUAL</span>
        @if (loading()) {
          <div class="spinner-white"></div>
        } @else {
          <span class="hero-value">{{ latest()?.peso_kg ?? '—' }} kg</span>
        }
        @if (diff()) {
          <div class="trend-row">
            <ion-icon [name]="parseDiff() <= 0 ? 'arrow-down' : 'arrow-up'" style="color:rgba(255,255,255,0.85);font-size:14px"></ion-icon>
            <span class="trend-text">{{ diff() }} kg desde el inicio</span>
          </div>
        }
        @if (latest()) {
          <div class="mini-stats">
            @if (latest()!.imc != null) {
              <div class="mini-stat"><span class="mini-val">{{ latest()!.imc!.toFixed(1) }}</span><span class="mini-lbl">IMC</span></div>
            }
            @if (latest()!.grasa_corporal_pct != null) {
              <div class="mini-stat"><span class="mini-val">{{ latest()!.grasa_corporal_pct }}%</span><span class="mini-lbl">Grasa</span></div>
            }
            @if (latest()!.masa_muscular_kg != null) {
              <div class="mini-stat"><span class="mini-val">{{ latest()!.masa_muscular_kg }}kg</span><span class="mini-lbl">Músculo</span></div>
            }
          </div>
        }
      </div>

      <!-- Chart placeholder (SVG sparkline) -->
      @if (chartData().length >= 2) {
        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Últimas mediciones</h3>
            @if (diff()) {
              <span class="trend-badge">
                <ion-icon [name]="parseDiff() <= 0 ? 'trending-down' : 'trending-up'" style="font-size:14px"></ion-icon>
                {{ diff() }} kg
              </span>
            }
          </div>
          <div class="chart-wrap">
            <svg [attr.viewBox]="'0 0 300 ' + (chartH + 10)" width="100%" [attr.height]="chartH + 10">
              <polyline [attr.points]="chartPoints()" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
              @for (pt of chartCircles(); track $index; let i = $index) {
                <circle [attr.cx]="pt.cx" [attr.cy]="pt.cy"
                  [attr.r]="i === chartCircles().length - 1 ? 5 : 3"
                  [attr.fill]="i === chartCircles().length - 1 ? '#38bdf8' : '#f6eed1'"
                  stroke="#38bdf8" stroke-width="2"/>
              }
            </svg>
          </div>
        </div>
      }

      <!-- History -->
      @if (entries().length > 0) {
        <div class="card">
          <h3 class="card-title">Historial</h3>
          @for (e of entries().slice(0, 10); track e.id) {
            <div class="entry-row">
              <span class="entry-dot"></span>
              <span class="entry-date">{{ e.fecha.substring(0,10) }}</span>
              <span class="entry-weight">{{ e.peso_kg }} kg</span>
              <div class="entry-badges">
                @if (e.imc != null) { <span class="ebadge sky">IMC {{ e.imc!.toFixed(1) }}</span> }
                @if (e.grasa_corporal_pct != null) { <span class="ebadge orange">{{ e.grasa_corporal_pct }}% grasa</span> }
              </div>
            </div>
          }
        </div>
      }

      <!-- Register button -->
      <button class="register-btn" (click)="showModal.set(true)">
        <ion-icon name="add-circle-outline"></ion-icon>
        {{ entries().length === 0 ? 'Iniciar seguimiento de peso' : 'Registrar peso' }}
      </button>
    </div>

    <!-- Modal -->
    @if (showModal()) {
      <div class="modal-overlay" (click)="showModal.set(false)">
        <div class="modal-sheet" (click)="$event.stopPropagation()">
          <div class="modal-handle"></div>
          <div class="modal-title-row">
            <h3 class="modal-title">{{ entries().length === 0 ? 'Primer registro' : 'Registrar peso' }}</h3>
            <button class="close-btn" (click)="showModal.set(false)"><ion-icon name="close"></ion-icon></button>
          </div>

          <div class="modal-scroll">
            <div class="sec-header">⚖️ <span>Básico</span></div>

            <div class="field-wrap">
              <div class="field-label-row"><label>Peso</label><span class="req">*</span><span class="suffix">kg</span></div>
              <input class="field-input" type="number" step="0.1" placeholder="ej. 70.5" [(ngModel)]="formPeso" />
            </div>

            <div class="field-wrap">
              <div class="field-label-row"><label>Altura</label><span class="suffix">cm</span></div>
              <input class="field-input" type="number" step="1" placeholder="ej. 170" [(ngModel)]="formAltura" />
            </div>

            @if (formImc()) {
              <div class="imc-badge">
                <ion-icon name="analytics-outline" style="color:#38bdf8"></ion-icon>
                <span>IMC calculado: {{ formImc() }} — {{ imcLabel(formImc()!) }}</span>
              </div>
            }

            <button class="toggle-btn" (click)="showOptional.set(!showOptional())">
              <ion-icon [name]="showOptional() ? 'chevron-up-outline' : 'chevron-down-outline'"></ion-icon>
              {{ showOptional() ? 'Ocultar campos opcionales' : 'Mostrar campos opcionales' }}
            </button>

            @if (showOptional()) {
              <div class="sec-header">📏 <span>Medidas corporales</span></div>
              <div class="row2">
                <div class="field-wrap half">
                  <div class="field-label-row"><label>Grasa corporal</label><span class="suffix">%</span></div>
                  <input class="field-input" type="number" step="0.1" placeholder="ej. 18" [(ngModel)]="formGrasa" />
                </div>
                <div class="field-wrap half">
                  <div class="field-label-row"><label>Masa muscular</label><span class="suffix">kg</span></div>
                  <input class="field-input" type="number" step="0.1" placeholder="ej. 35" [(ngModel)]="formMusculo" />
                </div>
              </div>
              <div class="row2">
                <div class="field-wrap half">
                  <div class="field-label-row"><label>Cintura</label><span class="suffix">cm</span></div>
                  <input class="field-input" type="number" step="0.5" placeholder="ej. 82" [(ngModel)]="formCintura" />
                </div>
                <div class="field-wrap half">
                  <div class="field-label-row"><label>Cadera</label><span class="suffix">cm</span></div>
                  <input class="field-input" type="number" step="0.5" placeholder="ej. 96" [(ngModel)]="formCadera" />
                </div>
              </div>

              <div class="sec-header">💚 <span>Bienestar</span></div>
              <div class="energy-wrap">
                <label class="energy-label">Nivel de energía</label>
                <div class="energy-row">
                  @for (n of [1,2,3,4,5]; track n) {
                    <button class="energy-dot" [style.background]="formEnergia == n ? energyColors[n] : '#f6eed1'" [style.border-color]="formEnergia == n ? energyColors[n] : '#d4c89a'" (click)="formEnergia = formEnergia == n ? 0 : n">
                      <span [style.color]="formEnergia == n ? '#fff' : '#136967'">{{ n }}</span>
                    </button>
                  }
                  @if (formEnergia > 0) {
                    <span class="energy-hint" [style.color]="energyColors[formEnergia]">{{ energyLabels[formEnergia] }}</span>
                  }
                </div>
              </div>
              <div class="row2">
                <div class="field-wrap half">
                  <div class="field-label-row"><label>Sueño</label><span class="suffix">h</span></div>
                  <input class="field-input" type="number" step="0.5" placeholder="ej. 7.5" [(ngModel)]="formSueno" />
                </div>
                <div class="field-wrap half">
                  <div class="field-label-row"><label>Hidratación</label><span class="suffix">L</span></div>
                  <input class="field-input" type="number" step="0.1" placeholder="ej. 2" [(ngModel)]="formHidrat" />
                </div>
              </div>

              <div class="sec-header">📝 <span>Notas</span></div>
              <textarea class="notas-input" rows="3" placeholder="Observaciones, cómo te sentiste hoy..." [(ngModel)]="formNotas"></textarea>
            }

            <button class="save-btn" [disabled]="!formPeso || saving()" (click)="guardar()">
              @if (saving()) { <div class="spinner-sm"></div> } @else { <ion-icon name="checkmark-circle-outline"></ion-icon> }
              Guardar registro
            </button>
            <button class="cancel-btn" (click)="showModal.set(false)">Cancelar</button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { padding: 16px 16px 32px; display: flex; flex-direction: column; gap: 14px; background: #fff9ea; min-height: 100%; }
    .page-title { font-size: 24px; font-weight: 800; color: #1f1c0a; margin: 0; }

    .hero { background: linear-gradient(135deg, #2f6648, #1F7A3E); border-radius: 20px; padding: 20px; display: flex; flex-direction: column; gap: 4px; }
    .hero-label { color: rgba(255,255,255,0.7); font-size: 11px; font-weight: 700; letter-spacing: 1px; }
    .hero-value { color: #fff; font-size: 44px; font-weight: 800; margin-top: 4px; }
    .trend-row  { display: flex; align-items: center; gap: 4px; margin-top: 2px; }
    .trend-text { color: rgba(255,255,255,0.85); font-size: 13px; }
    .mini-stats { display: flex; gap: 16px; margin-top: 12px; flex-wrap: wrap; }
    .mini-stat  { display: flex; flex-direction: column; align-items: center; }
    .mini-val   { color: #fff; font-size: 15px; font-weight: 700; }
    .mini-lbl   { color: rgba(255,255,255,0.65); font-size: 11px; margin-top: 1px; }
    .spinner-white { width: 28px; height: 28px; border: 3px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; margin: 8px 0; }

    .card { background: #f6eed1; border-radius: 16px; padding: 16px; }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }
    .card-title { font-size: 16px; font-weight: 700; color: #1f1c0a; margin: 0 0 4px; }
    .trend-badge { display: flex; align-items: center; gap: 4px; background: rgba(47,102,72,0.12); padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; color: #2f6648; }
    .chart-wrap { display: flex; justify-content: center; }

    .entry-row   { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 10px 0; border-bottom: 1px solid rgba(47,102,72,0.1); }
    .entry-dot   { width: 8px; height: 8px; border-radius: 4px; background: #38bdf8; flex-shrink: 0; }
    .entry-date  { font-size: 13px; color: #136967; min-width: 72px; }
    .entry-weight{ font-size: 15px; font-weight: 700; color: #1f1c0a; }
    .entry-badges{ display: flex; gap: 6px; flex-wrap: wrap; flex: 1; }
    .ebadge      { font-size: 11px; font-weight: 600; padding: 2px 7px; border-radius: 8px; }
    .ebadge.sky  { background: rgba(56,189,248,0.15); color: #0284c7; }
    .ebadge.orange { background: rgba(249,115,22,0.12); color: #f97316; }

    .register-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 16px; border-radius: 14px; background: #38bdf8; border: none; font-size: 15px; font-weight: 700; color: #fff; cursor: pointer; font-family: inherit; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; z-index: 100; }
    .modal-sheet { background: #fff9ea; border-radius: 24px 24px 0 0; padding: 0 20px 24px; max-height: 92dvh; width: 100%; overflow-y: auto; box-sizing: border-box; }
    .modal-handle { width: 40px; height: 4px; border-radius: 2px; background: rgba(47,102,72,0.2); margin: 10px auto 14px; }
    .modal-title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .modal-title { font-size: 20px; font-weight: 800; color: #1f1c0a; margin: 0; }
    .close-btn { background: #f6eed1; border: none; width: 32px; height: 32px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #136967; cursor: pointer; }
    .modal-scroll { display: flex; flex-direction: column; gap: 0; }

    .sec-header { display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid rgba(47,102,72,0.1); margin-bottom: 14px; font-size: 12px; font-weight: 700; color: #136967; text-transform: uppercase; letter-spacing: 0.5px; }
    .field-wrap { margin-bottom: 12px; }
    .field-wrap.half { flex: 1; }
    .row2 { display: flex; gap: 12px; }
    .field-label-row { display: flex; align-items: center; gap: 4px; margin-bottom: 6px; }
    .field-label-row label { font-size: 13px; font-weight: 600; color: #136967; flex: 1; }
    .req    { color: #ef4444; font-size: 13px; font-weight: 700; }
    .suffix { font-size: 11px; color: #136967; margin-left: auto; }
    .field-input { width: 100%; background: #f6eed1; border: 1.5px solid transparent; border-radius: 12px; padding: 11px 14px; font-size: 15px; color: #1f1c0a; font-family: inherit; box-sizing: border-box; outline: none; }
    .field-input:focus { border-color: #2f6648; }

    .imc-badge { display: flex; align-items: center; gap: 8px; padding: 10px; border-radius: 12px; background: rgba(56,189,248,0.1); margin-bottom: 12px; font-size: 13px; font-weight: 600; color: #0284c7; }
    .toggle-btn { display: flex; align-items: center; gap: 8px; padding: 12px; border-radius: 12px; background: #f6eed1; border: none; font-size: 13px; font-weight: 600; color: #136967; cursor: pointer; font-family: inherit; margin-bottom: 20px; }

    .energy-wrap  { margin-bottom: 12px; }
    .energy-label { display: block; font-size: 13px; font-weight: 600; color: #136967; margin-bottom: 8px; }
    .energy-row   { display: flex; align-items: center; gap: 8px; }
    .energy-dot   { width: 38px; height: 38px; border-radius: 19px; border: 2px solid; display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .energy-dot span { font-size: 15px; font-weight: 700; }
    .energy-hint  { font-size: 12px; font-weight: 600; margin-left: 4px; }

    .notas-input { width: 100%; background: #f6eed1; border: 1.5px solid transparent; border-radius: 12px; padding: 12px; font-size: 14px; color: #1f1c0a; font-family: inherit; resize: none; box-sizing: border-box; outline: none; margin-bottom: 12px; }
    .notas-input:focus { border-color: #2f6648; }

    .save-btn   { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 16px; border-radius: 14px; background: #2f6648; border: none; font-size: 15px; font-weight: 700; color: #fff; cursor: pointer; font-family: inherit; margin-top: 4px; }
    .save-btn:disabled { opacity: 0.6; cursor: default; }
    .cancel-btn { display: block; width: 100%; padding: 12px; background: transparent; border: none; font-size: 14px; color: #136967; cursor: pointer; font-family: inherit; margin-top: 8px; }
    .spinner-sm { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class PesoComponent implements OnInit {
  auth = inject(AuthStore);
  private nutricionSvc = inject(NutricionService);

  loading    = signal(true);
  saving     = signal(false);
  showModal  = signal(false);
  showOptional = signal(false);
  allEntries = signal<NutricionProgreso[]>([]);

  formPeso = '';  formAltura = ''; formGrasa = '';  formMusculo = '';
  formCintura = ''; formCadera = ''; formSueno = ''; formHidrat = '';
  formEnergia = 0; formNotas = '';

  readonly energyLabels = ENERGY_LABELS;
  readonly energyColors = ENERGY_COLORS;
  readonly chartH = 100;

  entries   = () => this.allEntries().filter(e => e.peso_kg != null).sort((a,b) => b.fecha.localeCompare(a.fecha));
  latest    = () => this.entries()[0] ?? null;
  oldest    = () => this.entries()[this.entries().length - 1] ?? null;
  chartData = () => this.entries().slice(0,7).map(e => e.peso_kg!).reverse();
  diff      = () => {
    const l = this.latest(), o = this.oldest();
    if (!l || !o || l.id === o.id) return null;
    return (l.peso_kg! - o.peso_kg!).toFixed(1);
  };
  parseDiff = () => parseFloat(this.diff() ?? '0');

  chartPoints = () => {
    const data = this.chartData();
    if (data.length < 2) return '';
    const min = Math.min(...data) - 0.5, max = Math.max(...data) + 0.5;
    const range = max - min || 1, stepX = 300 / (data.length - 1);
    return data.map((v,i) => `${i * stepX},${this.chartH - ((v - min) / range) * this.chartH}`).join(' ');
  };
  chartCircles = () => {
    const data = this.chartData();
    if (data.length < 2) return [];
    const min = Math.min(...data) - 0.5, max = Math.max(...data) + 0.5;
    const range = max - min || 1, stepX = 300 / (data.length - 1);
    return data.map((v,i) => ({ cx: i * stepX, cy: this.chartH - ((v - min) / range) * this.chartH }));
  };

  formImc = () => {
    const p = parseFloat(this.formPeso), a = parseFloat(this.formAltura);
    return (p > 0 && a > 0) ? +( p / ((a / 100) ** 2) ).toFixed(1) : null;
  };
  imcLabel = imcLabel;

  ngOnInit(): void {
    const pid = this.auth.pacienteId();
    if (!pid) { this.loading.set(false); return; }
    this.nutricionSvc.getProgreso(pid).pipe(catchError(() => of({ data: [] } as any))).subscribe(r => {
      this.allEntries.set(r.data ?? []);
      this.loading.set(false);
    });
  }

  guardar(): void {
    const peso = parseFloat(this.formPeso);
    if (!peso || this.saving()) return;
    this.saving.set(true);
    const pid = this.auth.pacienteId()!;
    const today = new Date().toISOString().split('T')[0];
    const payload: CrearProgresoPayload = { fecha: today, peso_kg: peso };
    const altura = parseFloat(this.formAltura);
    if (altura > 0) { payload.altura_cm = altura; const imc = this.formImc(); if (imc) payload.imc = imc; }
    if (this.formGrasa)   payload.grasa_corporal_pct   = parseFloat(this.formGrasa);
    if (this.formMusculo) payload.masa_muscular_kg      = parseFloat(this.formMusculo);
    if (this.formCintura) payload.cintura_cm            = parseFloat(this.formCintura);
    if (this.formCadera)  payload.cadera_cm             = parseFloat(this.formCadera);
    if (this.formEnergia > 0) payload.energia_nivel     = this.formEnergia;
    if (this.formSueno)   payload.sueno_horas           = parseFloat(this.formSueno);
    if (this.formHidrat)  payload.hidratacion_litros    = parseFloat(this.formHidrat);
    if (this.formNotas.trim()) payload.notas            = this.formNotas.trim();

    this.nutricionSvc.crearProgreso(pid, payload).pipe(catchError(() => of(null))).subscribe(nuevo => {
      if (nuevo) this.allEntries.update(list => [nuevo, ...list]);
      this.saving.set(false);
      this.showModal.set(false);
      this.formPeso = ''; this.formAltura = ''; this.formGrasa = ''; this.formMusculo = '';
      this.formCintura = ''; this.formCadera = ''; this.formEnergia = 0;
      this.formSueno = ''; this.formHidrat = ''; this.formNotas = '';
      this.showOptional.set(false);
    });
  }
}
