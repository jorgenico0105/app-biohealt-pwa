import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { AuthStore } from '../../core/store/auth.store';
import { TurnosService, Cita, TipoCita, CrearCitaPayload } from '../../core/services/turnos.service';

const DAYS_OF_WEEK = ['L','M','X','J','V','S','D'];
const MONTH_NAMES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const ESTADO_COLOR: Record<string, string> = { PE:'#d97706', CF:'#38bdf8', AT:'#22c55e', CA:'#f43f5e', NA:'#888888' };
const ESTADO_LABEL: Record<string, string> = { PE:'Pendiente', CF:'Confirmada', AT:'Atendida', CA:'Cancelada', NA:'No Asistió' };

function buildCalendarMatrix(year: number, month: number): (number|null)[][] {
  const firstDay = new Date(year, month, 1).getDay();
  const offset   = (firstDay + 6) % 7;
  const days     = new Date(year, month + 1, 0).getDate();
  const cells: (number|null)[] = [...Array(offset).fill(null), ...Array.from({length: days}, (_,i) => i+1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const mat: (number|null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) mat.push(cells.slice(i, i+7));
  return mat;
}

function parseFechaDate(fecha: string): Date {
  return new Date(fecha.substring(0,10) + 'T00:00:00');
}

function formatCitaDate(fecha: string, hora: string): string {
  try {
    const d = parseFechaDate(fecha);
    const days = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} · ${hora.slice(0,5)}`;
  } catch { return `${fecha.substring(0,10)} · ${hora}`; }
}

@Component({
  selector: 'app-turnos',
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="page">
      <!-- Header -->
      <div class="header">
        <h2 class="title">Turnos</h2>
        <button class="new-btn" (click)="showCreate.set(true)">
          <ion-icon name="add"></ion-icon> Nueva cita
        </button>
      </div>

      <!-- Doctor Banner -->
      <div class="doctor-banner">
        <div class="doctor-avatar">{{ doctorInitials() }}</div>
        <div class="doctor-info">
          <span class="doctor-name">{{ doctorDisplayName() }}</span>
          <span class="doctor-spec">{{ doctorSpec() }}</span>
        </div>
        @if (pendingCount() > 0) {
          <div class="available-badge">
            <span class="avail-dot"></span>
            <span>{{ pendingCount() }} pendiente(s)</span>
          </div>
        }
      </div>

      <!-- Calendar -->
      <div class="card">
        <div class="month-nav">
          <button class="nav-btn" (click)="goPrevMonth()"><ion-icon name="chevron-back" style="font-size:16px"></ion-icon></button>
          <span class="month-title">{{ MONTH_NAMES[calMonth()] }} {{ calYear() }}</span>
          <button class="nav-btn" (click)="goNextMonth()"><ion-icon name="chevron-forward" style="font-size:16px"></ion-icon></button>
        </div>
        <div class="cal-grid">
          @for (d of DAYS_OF_WEEK; track d) {
            <div class="cal-cell"><span class="day-header">{{ d }}</span></div>
          }
        </div>
        @for (week of calMatrix(); track $index) {
          <div class="cal-grid">
            @for (day of week; track $index; let di = $index) {
              @if (!day) {
                <div class="cal-cell"></div>
              } @else {
                <button class="cal-cell cal-day-btn"
                  [style.background]="day === selectedDay() ? '#2f6648' : isToday(day) ? 'rgba(47,102,72,0.1)' : 'transparent'"
                  [style.border]="isToday(day) && day !== selectedDay() ? '1px solid rgba(47,102,72,0.3)' : '1px solid transparent'"
                  (click)="selectedDay.set(day)">
                  <span [style.color]="day === selectedDay() ? '#fff' : isToday(day) ? '#2f6648' : '#1f1c0a'" [style.font-weight]="(day === selectedDay() || isToday(day)) ? '700' : '400'">{{ day }}</span>
                  @if (appointmentDays()[day]) {
                    <span class="cal-dot" [style.background]="day === selectedDay() ? '#fff' : (ESTADO_COLOR[appointmentDays()[day]] ?? '#2f6648')"></span>
                  }
                </button>
              }
            }
          </div>
        }
      </div>

      <!-- Selected day citas -->
      <div class="card">
        <div class="card-title-row">
          <h3 class="card-title">{{ selectedDay() }} {{ MONTH_NAMES[calMonth()] }}</h3>
          <button class="add-day-btn" (click)="showCreate.set(true)">
            <ion-icon name="add" style="font-size:14px"></ion-icon> Agregar
          </button>
        </div>
        @if (loading()) {
          <div class="loading-wrap"><div class="spinner"></div></div>
        } @else if (selectedDayCitas().length === 0) {
          <p class="empty-text">Sin citas para este día.</p>
        } @else {
          @for (cita of selectedDayCitas(); track cita.id) {
            <div class="slot-row" [style.background]="(ESTADO_COLOR[cita.estado_cita?.codigo ?? 'PE'] ?? '#d97706') + '14'" [style.border-color]="(ESTADO_COLOR[cita.estado_cita?.codigo ?? 'PE'] ?? '#d97706') + '35'">
              <div class="slot-time" [style.background]="(ESTADO_COLOR[cita.estado_cita?.codigo ?? 'PE'] ?? '#d97706') + '14'">
                <span [style.color]="ESTADO_COLOR[cita.estado_cita?.codigo ?? 'PE'] ?? '#d97706'">{{ cita.hora.slice(0,5) }}</span>
              </div>
              <div class="slot-info">
                <span class="slot-label">{{ cita.tipo_cita?.nombre ?? 'Consulta' }}</span>
                @if (cita.motivo) { <span class="slot-sub">{{ cita.motivo }}</span> }
              </div>
              <span class="slot-badge" [style.background]="(ESTADO_COLOR[cita.estado_cita?.codigo ?? 'PE'] ?? '#d97706') + '18'" [style.color]="ESTADO_COLOR[cita.estado_cita?.codigo ?? 'PE'] ?? '#d97706'">
                {{ ESTADO_LABEL[cita.estado_cita?.codigo ?? 'PE'] ?? cita.estado_cita?.codigo }}
              </span>
            </div>
          }
        }
      </div>

      <!-- All citas list -->
      <div class="card">
        <h3 class="card-title" style="margin-bottom:14px">Mis citas</h3>
        @if (loading()) {
          <div class="loading-wrap"><div class="spinner"></div></div>
        } @else if (citas().length === 0) {
          <p class="empty-text">Sin citas registradas.</p>
        } @else {
          @for (apt of citas(); track apt.id) {
            <div class="apt-row" [style.background]="(ESTADO_COLOR[apt.estado_cita?.codigo ?? 'PE'] ?? '#d97706') + '0E'" [style.border-color]="(ESTADO_COLOR[apt.estado_cita?.codigo ?? 'PE'] ?? '#d97706') + '30'">
              <div class="apt-icon" [style.background]="(ESTADO_COLOR[apt.estado_cita?.codigo ?? 'PE'] ?? '#d97706') + '1A'">
                <ion-icon name="calendar-outline" [style.color]="ESTADO_COLOR[apt.estado_cita?.codigo ?? 'PE'] ?? '#d97706'"></ion-icon>
              </div>
              <div class="apt-info">
                <span class="apt-date">{{ formatCitaDate(apt.fecha, apt.hora) }}</span>
                <span class="apt-doctor">{{ apt.tipo_cita?.nombre ?? 'Consulta' }} · {{ doctorDisplayName() }}</span>
              </div>
              <span class="apt-badge" [style.background]="(ESTADO_COLOR[apt.estado_cita?.codigo ?? 'PE'] ?? '#d97706') + '22'" [style.color]="ESTADO_COLOR[apt.estado_cita?.codigo ?? 'PE'] ?? '#d97706'" [style.border-color]="(ESTADO_COLOR[apt.estado_cita?.codigo ?? 'PE'] ?? '#d97706') + '44'">
                {{ ESTADO_LABEL[apt.estado_cita?.codigo ?? 'PE'] ?? apt.estado_cita?.codigo }}
              </span>
            </div>
          }
        }
      </div>
    </div>

    <!-- FAB -->
    <button class="fab" (click)="showCreate.set(true)"><ion-icon name="add" style="font-size:26px;color:#fff"></ion-icon></button>

    <!-- Create cita modal -->
    @if (showCreate()) {
      <div class="modal-overlay" (click)="closeModal()">
        <div class="modal-sheet" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <h3 class="modal-title">Nueva Cita</h3>
            <button class="close-btn" (click)="closeModal()"><ion-icon name="close"></ion-icon></button>
          </div>
          <div class="modal-scroll">
            <!-- Date -->
            <div class="form-section">
              <label class="form-label">Fecha</label>
              <button class="date-box" (click)="datePickerOpen.set(!datePickerOpen())">
                <ion-icon name="calendar-outline" style="color:#2f6648"></ion-icon>
                <span style="flex:1;text-align:left;font-size:15px;font-weight:600;color:#1f1c0a">{{ modalDay() }} {{ MONTH_NAMES[modalMonth()] }} {{ modalYear() }}</span>
                <ion-icon [name]="datePickerOpen() ? 'chevron-up' : 'chevron-down'" style="color:#136967"></ion-icon>
              </button>
              @if (datePickerOpen()) {
                <div class="inline-cal">
                  <div class="cal-month-nav">
                    <button class="cal-nav-btn" (click)="goPrevModalMonth()"><ion-icon name="chevron-back" style="font-size:14px"></ion-icon></button>
                    <span style="font-size:13px;font-weight:700;color:#1f1c0a">{{ MONTH_NAMES[modalMonth()] }} {{ modalYear() }}</span>
                    <button class="cal-nav-btn" (click)="goNextModalMonth()"><ion-icon name="chevron-forward" style="font-size:14px"></ion-icon></button>
                  </div>
                  <div class="cal-grid">
                    @for (d of DAYS_OF_WEEK; track d) {
                      <span class="cal-day-hdr">{{ d }}</span>
                    }
                  </div>
                  @for (week of modalMatrix(); track $index) {
                    <div class="cal-grid">
                      @for (day of week; track $index) {
                        @if (!day) { <div class="modal-cal-cell"></div> }
                        @else {
                          <button class="modal-cal-cell modal-cal-btn"
                            [style.background]="day === modalDay() ? '#2f6648' : 'transparent'"
                            [style.color]="day === modalDay() ? '#fff' : '#1f1c0a'"
                            (click)="modalDay.set(day); datePickerOpen.set(false)">
                            {{ day }}
                          </button>
                        }
                      }
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Time -->
            <div class="form-section">
              <label class="form-label">Hora</label>
              <div class="time-picker">
                <div class="time-unit">
                  <button class="time-btn" (click)="incHH()"><ion-icon name="chevron-up"></ion-icon></button>
                  <span class="time-value">{{ hh().toString().padStart(2,'0') }}</span>
                  <button class="time-btn" (click)="decHH()"><ion-icon name="chevron-down"></ion-icon></button>
                </div>
                <span class="time-sep">:</span>
                <div class="time-unit">
                  <button class="time-btn" (click)="incMM()"><ion-icon name="chevron-up"></ion-icon></button>
                  <span class="time-value">{{ mm().toString().padStart(2,'0') }}</span>
                  <button class="time-btn" (click)="decMM()"><ion-icon name="chevron-down"></ion-icon></button>
                </div>
              </div>
            </div>

            <!-- Tipo cita -->
            <div class="form-section">
              <label class="form-label">Tipo de cita</label>
              @if (loadingTipos()) {
                <div class="loading-wrap"><div class="spinner"></div></div>
              } @else {
                <div class="tipos-grid">
                  @for (t of tiposCita(); track t.id) {
                    <button class="tipo-chip" [style.background]="selectedTipoId() === t.id ? '#2f6648' : '#f6eed1'" [style.color]="selectedTipoId() === t.id ? '#fff' : '#1f1c0a'" [style.border-color]="selectedTipoId() === t.id ? '#2f6648' : 'rgba(47,102,72,0.2)'" (click)="selectedTipoId.set(t.id)">
                      {{ t.nombre }}
                    </button>
                  }
                </div>
              }
            </div>

            <!-- Motivo -->
            <div class="form-section">
              <label class="form-label">Motivo <span style="color:#136967;text-transform:none">(opcional)</span></label>
              <textarea class="motivo-input" rows="2" placeholder="Describe el motivo de la cita..." [(ngModel)]="motivo"></textarea>
            </div>

            @if (createError()) {
              <div class="error-banner">
                <ion-icon name="alert-circle-outline"></ion-icon>
                <span>{{ createError() }}</span>
              </div>
            }

            <button class="submit-btn" [disabled]="creating()" (click)="crearCita()">
              @if (creating()) { <div class="spinner-sm"></div> }
              @else { <ion-icon name="calendar-outline" style="font-size:18px;color:#fff"></ion-icon> }
              <span style="color:#fff">Solicitar cita</span>
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .page { padding: 16px 16px 100px; display: flex; flex-direction: column; gap: 14px; background: #fff9ea; min-height: 100%; }
    .header { display: flex; justify-content: space-between; align-items: center; }
    .title  { font-size: 24px; font-weight: 800; color: #1f1c0a; margin: 0; }
    .new-btn { display: flex; align-items: center; gap: 5px; padding: 8px 14px; border-radius: 20px; background: #2f6648; border: none; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }

    .doctor-banner { background: linear-gradient(135deg, #2f6648, #1F7A3E); border-radius: 16px; padding: 16px; display: flex; align-items: center; gap: 14px; }
    .doctor-avatar { width: 52px; height: 52px; border-radius: 26px; background: rgba(255,255,255,0.25); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 18px; font-weight: 700; flex-shrink: 0; }
    .doctor-info   { flex: 1; }
    .doctor-name   { display: block; color: #fff; font-size: 15px; font-weight: 700; }
    .doctor-spec   { display: block; color: rgba(255,255,255,0.8); font-size: 12px; margin-top: 2px; }
    .available-badge { display: flex; align-items: center; gap: 5px; background: rgba(255,255,255,0.2); padding: 5px 10px; border-radius: 20px; }
    .available-badge span { color: #fff; font-size: 11px; font-weight: 600; }
    .avail-dot { width: 6px; height: 6px; border-radius: 3px; background: #fff; }

    .card { background: #f6eed1; border-radius: 16px; border: 1px solid rgba(47,102,72,0.15); padding: 16px; }
    .loading-wrap { display: flex; justify-content: center; padding: 20px; }
    .spinner { width: 24px; height: 24px; border: 3px solid rgba(47,102,72,0.2); border-top-color: #2f6648; border-radius: 50%; animation: spin 0.7s linear infinite; }

    .month-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; }
    .nav-btn    { width: 32px; height: 32px; border-radius: 8px; background: rgba(47,102,72,0.08); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #136967; }
    .month-title { font-size: 15px; font-weight: 700; color: #1f1c0a; }
    .cal-grid  { display: grid; grid-template-columns: repeat(7, 1fr); margin-bottom: 4px; }
    .cal-cell  { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2px 1px; }
    .day-header { font-size: 11px; font-weight: 600; color: #136967; text-transform: uppercase; padding: 4px 0; }
    .cal-day-btn { border-radius: 8px; padding: 6px 2px; border: none; cursor: pointer; background: transparent; min-height: 36px; }
    .cal-dot { width: 4px; height: 4px; border-radius: 2px; margin-top: 2px; }

    .card-title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .card-title { font-size: 15px; font-weight: 700; color: #1f1c0a; margin: 0; }
    .add-day-btn { display: flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 20px; background: rgba(47,102,72,0.1); border: 1px solid rgba(47,102,72,0.2); font-size: 12px; font-weight: 600; color: #2f6648; cursor: pointer; font-family: inherit; }
    .empty-text { font-size: 13px; color: #136967; text-align: center; padding: 12px 0; margin: 0; }

    .slot-row { display: flex; align-items: center; gap: 12px; padding: 12px; border-radius: 12px; border: 1px solid; margin-bottom: 8px; }
    .slot-time { padding: 6px 10px; border-radius: 8px; }
    .slot-time span { font-size: 13px; font-weight: 700; }
    .slot-info  { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .slot-label { font-size: 13px; font-weight: 600; color: #1f1c0a; }
    .slot-sub   { font-size: 11px; color: #136967; }
    .slot-badge { padding: 3px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }

    .apt-row { display: flex; align-items: center; gap: 12px; padding: 14px; border-radius: 14px; border: 1px solid; margin-bottom: 8px; }
    .apt-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
    .apt-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .apt-date  { font-size: 14px; font-weight: 700; color: #1f1c0a; }
    .apt-doctor{ font-size: 12px; color: #136967; }
    .apt-badge { padding: 4px 10px; border-radius: 20px; border: 1px solid; font-size: 11px; font-weight: 600; }

    .fab { position: fixed; bottom: 80px; right: 20px; width: 56px; height: 56px; border-radius: 28px; background: #2f6648; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 12px rgba(47,102,72,0.4); z-index: 50; }

    /* Modal */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: flex-end; z-index: 100; }
    .modal-sheet   { background: #fff9ea; border-radius: 24px 24px 0 0; padding: 0 20px 24px; max-height: 90dvh; width: 100%; overflow-y: auto; box-sizing: border-box; }
    .modal-header  { display: flex; align-items: center; justify-content: space-between; padding: 20px 0 0; margin-bottom: 20px; }
    .modal-title   { font-size: 18px; font-weight: 800; color: #1f1c0a; margin: 0; }
    .close-btn     { background: #f6eed1; border: none; width: 32px; height: 32px; border-radius: 16px; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #136967; cursor: pointer; }
    .modal-scroll  { display: flex; flex-direction: column; gap: 0; }
    .form-section  { margin-bottom: 20px; }
    .form-label    { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #136967; margin-bottom: 8px; }
    .date-box { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-radius: 12px; background: #f6eed1; border: 1px solid rgba(47,102,72,0.2); width: 100%; cursor: pointer; font-family: inherit; box-sizing: border-box; }
    .inline-cal { margin-top: 8px; border-radius: 12px; border: 1px solid rgba(47,102,72,0.15); background: #f6eed1; padding: 12px; }
    .cal-month-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
    .cal-nav-btn { width: 28px; height: 28px; border-radius: 8px; background: rgba(47,102,72,0.08); border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #136967; }
    .cal-day-hdr { display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; text-transform: uppercase; color: #136967; padding: 4px 0; }
    .modal-cal-cell { display: flex; align-items: center; justify-content: center; padding: 4px 1px; }
    .modal-cal-btn  { border-radius: 7px; border: none; cursor: pointer; font-size: 13px; font-family: inherit; width: 100%; padding: 5px 0; }

    .time-picker { display: flex; align-items: center; justify-content: center; gap: 8px; }
    .time-unit   { display: flex; flex-direction: column; align-items: center; gap: 6px; }
    .time-btn    { width: 44px; height: 36px; border-radius: 10px; background: #f6eed1; border: none; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #136967; cursor: pointer; }
    .time-value  { font-size: 36px; font-weight: 800; color: #1f1c0a; min-width: 60px; text-align: center; }
    .time-sep    { font-size: 36px; font-weight: 800; color: #1f1c0a; margin-bottom: 6px; }

    .tipos-grid { display: flex; flex-wrap: wrap; gap: 8px; }
    .tipo-chip  { padding: 8px 14px; border-radius: 20px; border: 1px solid; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
    .motivo-input { width: 100%; background: #f6eed1; border: 1px solid rgba(47,102,72,0.2); border-radius: 12px; padding: 10px 14px; font-size: 14px; color: #1f1c0a; font-family: inherit; resize: none; outline: none; box-sizing: border-box; min-height: 70px; }
    .motivo-input:focus { border-color: #2f6648; }

    .error-banner { display: flex; align-items: center; gap: 6px; padding: 10px 12px; border-radius: 10px; background: rgba(186,26,26,0.08); border: 1px solid rgba(186,26,26,0.2); font-size: 13px; color: #ba1a1a; margin-bottom: 12px; }
    .submit-btn   { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; padding: 15px; border-radius: 14px; background: #2f6648; border: none; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; }
    .submit-btn:disabled { opacity: 0.7; cursor: default; }
    .spinner-sm { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class TurnosComponent implements OnInit {
  auth = inject(AuthStore);
  private turnosSvc = inject(TurnosService);

  MONTH_NAMES  = MONTH_NAMES;
  DAYS_OF_WEEK = DAYS_OF_WEEK;
  ESTADO_COLOR = ESTADO_COLOR;
  ESTADO_LABEL = ESTADO_LABEL;
  formatCitaDate = formatCitaDate;

  loading     = signal(true);
  citas       = signal<Cita[]>([]);
  tiposCita   = signal<TipoCita[]>([]);
  loadingTipos = signal(false);
  showCreate  = signal(false);
  creating    = signal(false);
  createError = signal<string | null>(null);
  datePickerOpen = signal(false);

  today = new Date();
  calYear    = signal(this.today.getFullYear());
  calMonth   = signal(this.today.getMonth());
  selectedDay = signal(this.today.getDate());

  modalYear  = signal(this.today.getFullYear());
  modalMonth = signal(this.today.getMonth());
  modalDay   = signal(this.today.getDate());
  hh = signal(9); mm = signal(0);
  selectedTipoId = signal(0);
  motivo = '';

  doctorDisplayName = computed(() => {
    const n = this.auth.doctorNombre(), a = this.auth.doctorApellidos();
    return n ? `${n}${a ? ' ' + a : ''}` : 'Equipo médico';
  });
  doctorInitials = computed(() => {
    const n = this.auth.doctorNombre(), a = this.auth.doctorApellidos();
    return n ? `${n[0] ?? ''}${a ? a[0] : ''}`.toUpperCase() : 'EM';
  });
  doctorSpec = computed(() => this.auth.doctorEspecialidad() ?? 'Profesional de salud');

  pendingCount = computed(() => this.citas().filter(c => ['CF','PE'].includes(c.estado_cita?.codigo ?? '')).length);

  calMatrix = computed(() => buildCalendarMatrix(this.calYear(), this.calMonth()));
  modalMatrix = computed(() => buildCalendarMatrix(this.modalYear(), this.modalMonth()));

  appointmentDays = computed(() => {
    const map: Record<number, string> = {};
    this.citas().forEach(c => {
      const d = parseFechaDate(c.fecha);
      if (d.getFullYear() === this.calYear() && d.getMonth() === this.calMonth()) {
        const day = d.getDate(), cod = c.estado_cita?.codigo ?? 'PE';
        const pri: Record<string,number> = { AT:4, CF:3, PE:2, CA:1, NA:0 };
        if (!map[day] || (pri[cod] ?? 0) > (pri[map[day]] ?? 0)) map[day] = cod;
      }
    });
    return map;
  });

  selectedDayCitas = computed(() => {
    const dateStr = `${this.calYear()}-${String(this.calMonth()+1).padStart(2,'0')}-${String(this.selectedDay()).padStart(2,'0')}`;
    return this.citas().filter(c => c.fecha.substring(0,10) === dateStr);
  });

  isToday = (day: number) => day === this.today.getDate() && this.calMonth() === this.today.getMonth() && this.calYear() === this.today.getFullYear();

  goPrevMonth()   { if (this.calMonth() === 0) { this.calYear.update(y=>y-1); this.calMonth.set(11); } else this.calMonth.update(m=>m-1); this.selectedDay.set(1); }
  goNextMonth()   { if (this.calMonth() === 11) { this.calYear.update(y=>y+1); this.calMonth.set(0); } else this.calMonth.update(m=>m+1); this.selectedDay.set(1); }
  goPrevModalMonth() { if (this.modalMonth() === 0) { this.modalYear.update(y=>y-1); this.modalMonth.set(11); } else this.modalMonth.update(m=>m-1); this.modalDay.set(1); }
  goNextModalMonth() { if (this.modalMonth() === 11) { this.modalYear.update(y=>y+1); this.modalMonth.set(0); } else this.modalMonth.update(m=>m+1); this.modalDay.set(1); }

  incHH() { this.hh.update(h => Math.min(h+1, 23)); }
  decHH() { this.hh.update(h => Math.max(h-1, 0)); }
  incMM() { this.mm.update(m => m+15 > 45 ? 0 : m+15); }
  decMM() { this.mm.update(m => m-15 < 0 ? 45 : m-15); }

  closeModal(): void {
    this.showCreate.set(false);
    this.createError.set(null);
    this.motivo = '';
    this.datePickerOpen.set(false);
  }

  ngOnInit(): void {
    const pid = this.auth.pacienteId();
    if (!pid) { this.loading.set(false); return; }
    this.turnosSvc.getCitasPaciente(pid).pipe(catchError(() => of([]))).subscribe(list => {
      this.citas.set(list);
      this.loading.set(false);
    });
    this.loadingTipos.set(true);
    this.turnosSvc.getTiposCita().pipe(catchError(() => of([]))).subscribe(tipos => {
      this.tiposCita.set(tipos);
      if (tipos.length > 0 && this.selectedTipoId() === 0) this.selectedTipoId.set(tipos[0].id);
      this.loadingTipos.set(false);
    });
  }

  crearCita(): void {
    if (this.selectedTipoId() === 0 || this.creating()) return;
    this.creating.set(true);
    this.createError.set(null);
    const pid = this.auth.pacienteId()!;
    const docId = this.auth.doctorId() ?? 0;
    const clinId = this.auth.clinicaId() ?? 0;
    const fecha = `${this.modalYear()}-${String(this.modalMonth()+1).padStart(2,'0')}-${String(this.modalDay()).padStart(2,'0')}`;
    const hora  = `${String(this.hh()).padStart(2,'0')}:${String(this.mm()).padStart(2,'0')}`;
    const payload: CrearCitaPayload = {
      fecha, hora, duracion_min: 30,
      id_medico: docId, id_paciente: pid, id_clinica: clinId,
      tipo_cita_id: this.selectedTipoId(),
      motivo: this.motivo.trim() || undefined,
    };
    this.turnosSvc.crearCita(payload).pipe(catchError(err => {
      this.createError.set(err?.error?.message ?? 'Error al crear la cita.');
      return of(null);
    })).subscribe(nueva => {
      this.creating.set(false);
      if (nueva) {
        this.citas.update(list => [...list, nueva]);
        this.closeModal();
      }
    });
  }
}
