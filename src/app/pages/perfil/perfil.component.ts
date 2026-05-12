import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { catchError, of } from 'rxjs';
import { AuthStore } from '../../core/store/auth.store';
import { NutricionService } from '../../core/services/nutricion.service';

@Component({
  selector: 'app-perfil',
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="page">
      <h2 class="page-title">Mi perfil</h2>

      <!-- Avatar card -->
      <div class="profile-card">
        <div class="avatar">{{ initials() }}</div>
        <div class="profile-info">
          <span class="profile-name">{{ auth.user() ?? 'Paciente' }}</span>
          <span class="profile-email">&#64;{{ auth.user() ?? '—' }}</span>
          <span class="active-badge">
            <span class="dot"></span> Paciente activo
          </span>
        </div>
      </div>

      <!-- Objectives -->
      <div class="section">
        <h3 class="section-title">Mis objetivos</h3>
        <div class="obj-grid">
          <div class="obj-card">
            <div class="obj-icon amber"><ion-icon name="flame-outline"></ion-icon></div>
            <div class="obj-info">
              <span class="obj-label">Calorías diarias</span>
              <span class="obj-value">{{ caloriasValue() }}</span>
            </div>
          </div>
          <div class="obj-card">
            <div class="obj-icon sky"><ion-icon name="scale-outline"></ion-icon></div>
            <div class="obj-info">
              <span class="obj-label">Peso objetivo</span>
              <span class="obj-value">{{ pesoObjetivoValue() }}</span>
            </div>
          </div>
        </div>
        <div class="obj-grid">
          <div class="obj-card">
            <div class="obj-icon teal"><ion-icon name="barbell-outline"></ion-icon></div>
            <div class="obj-info">
              <span class="obj-label">Proteínas</span>
              <span class="obj-value">{{ proteinasValue() }}</span>
            </div>
          </div>
          <div class="obj-card">
            <div class="obj-icon blue"><ion-icon name="water-outline"></ion-icon></div>
            <div class="obj-info">
              <span class="obj-label">Hidratación</span>
              <span class="obj-value">2,5 L / día</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Settings card -->
      <div class="settings-card">
        <h3 class="section-title">Preferencias</h3>

        <div class="setting-row">
          <div class="row-icon amber"><ion-icon name="notifications-outline"></ion-icon></div>
          <span class="row-label">Notificaciones</span>
          <ion-icon name="chevron-forward" class="row-arrow"></ion-icon>
        </div>

        <a class="setting-row" href="https://biohealth.koisaas.lat/privacy.html" target="_blank" rel="noopener">
          <div class="row-icon teal"><ion-icon name="shield-checkmark-outline"></ion-icon></div>
          <span class="row-label">Política de privacidad</span>
          <ion-icon name="open-outline" class="row-arrow"></ion-icon>
        </a>

        <a class="setting-row" href="https://biohealth.koisaas.lat/privacy.html" target="_blank" rel="noopener">
          <div class="row-icon teal"><ion-icon name="document-text-outline"></ion-icon></div>
          <span class="row-label">Términos y condiciones</span>
          <ion-icon name="open-outline" class="row-arrow"></ion-icon>
        </a>
      </div>

      <!-- Logout -->
      <button class="logout-btn" (click)="auth.logout()">
        <ion-icon name="log-out-outline"></ion-icon>
        Cerrar sesión
      </button>

      <!-- Delete account -->
      <a class="delete-link" href="mailto:soporte@biohealth.app?subject=Solicitud%20de%20cierre%20de%20cuenta">
        <ion-icon name="trash-outline"></ion-icon>
        Solicitar cierre de cuenta
      </a>
    </div>
  `,
  styles: [`
    .page { padding: 16px 16px 32px; display: flex; flex-direction: column; gap: 16px; background: #fff9ea; min-height: 100%; }
    .page-title { font-size: 26px; font-weight: 800; color: #1f1c0a; margin: 0; }

    .profile-card { background: #f6eed1; border-radius: 18px; padding: 18px; display: flex; align-items: center; gap: 16px; }
    .avatar { width: 68px; height: 68px; border-radius: 20px; background: linear-gradient(135deg, #48805f, #2f6648); color: #fff; font-size: 24px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .profile-info { flex: 1; display: flex; flex-direction: column; gap: 4px; }
    .profile-name { font-size: 18px; font-weight: 700; color: #1f1c0a; }
    .profile-email { font-size: 13px; color: #136967; }
    .active-badge { display: inline-flex; align-items: center; gap: 5px; background: rgba(47,102,72,0.1); border: 1px solid rgba(47,102,72,0.25); padding: 3px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; color: #2f6648; align-self: flex-start; margin-top: 4px; }
    .dot { width: 6px; height: 6px; border-radius: 3px; background: #2f6648; }

    .section { display: flex; flex-direction: column; gap: 10px; }
    .section-title { font-size: 16px; font-weight: 700; color: #1f1c0a; margin: 0 0 2px; }
    .obj-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .obj-card { background: #f6eed1; border-radius: 14px; padding: 14px; display: flex; align-items: center; gap: 12px; }
    .obj-icon { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; flex-shrink: 0; }
    .obj-icon.amber { background: rgba(245,158,11,0.12); color: #d97706; }
    .obj-icon.sky   { background: rgba(56,189,248,0.12); color: #0284c7; }
    .obj-icon.teal  { background: rgba(20,184,166,0.12); color: #136967; }
    .obj-icon.blue  { background: rgba(96,165,250,0.12); color: #3b82f6; }
    .obj-info { display: flex; flex-direction: column; gap: 2px; }
    .obj-label { font-size: 11px; font-weight: 500; color: #136967; }
    .obj-value { font-size: 14px; font-weight: 700; color: #1f1c0a; }

    .settings-card { background: #f6eed1; border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 0; }
    .setting-row, a.setting-row { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid rgba(47,102,72,0.1); text-decoration: none; cursor: pointer; }
    .setting-row:last-child { border-bottom: none; }
    .row-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
    .row-icon.amber { background: rgba(245,158,11,0.12); color: #d97706; }
    .row-icon.teal  { background: rgba(20,184,166,0.12); color: #136967; }
    .row-label { flex: 1; font-size: 15px; font-weight: 500; color: #1f1c0a; }
    .row-arrow { font-size: 16px; color: #136967; }

    .logout-btn { display: flex; align-items: center; justify-content: center; gap: 10px; padding: 16px; border-radius: 14px; background: rgba(244,63,94,0.08); border: 1px solid rgba(244,63,94,0.25); font-size: 15px; font-weight: 700; color: #f43f5e; cursor: pointer; font-family: inherit; }
    .delete-link { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border-radius: 14px; border: 1px solid rgba(47,102,72,0.15); font-size: 13px; font-weight: 500; color: #136967; text-decoration: none; }
  `],
})
export class PerfilComponent implements OnInit {
  auth = inject(AuthStore);
  private nutricionSvc = inject(NutricionService);

  private activaDieta = signal<any>(null);

  initials = computed(() => (this.auth.user() ?? 'P')[0].toUpperCase());

  caloriasValue = computed(() => {
    const d = this.activaDieta();
    return d?.calorias_dia_objetivo ? `${d.calorias_dia_objetivo.toLocaleString('es-AR')} kcal` : '— kcal';
  });
  pesoObjetivoValue = computed(() => this.activaDieta()?.resultado_esperado ?? '—');
  proteinasValue    = computed(() => {
    const d = this.activaDieta();
    return d?.proteinas_g_dia ? `${d.proteinas_g_dia} g / día` : '— g / día';
  });

  ngOnInit(): void {
    const pid = this.auth.pacienteId();
    if (!pid) return;
    this.nutricionSvc.getDietas(pid).pipe(catchError(() => of({ data: [] } as any))).subscribe(r => {
      this.activaDieta.set((r.data ?? []).find((d: any) => d.estado === 'ACTIVA') ?? null);
    });
  }
}
