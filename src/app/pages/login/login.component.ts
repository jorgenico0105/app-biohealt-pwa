import { Component, CUSTOM_ELEMENTS_SCHEMA, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="login-wrap">
      <!-- Header gradient -->
      <div class="login-header">
        <div class="circle circle-tr"></div>
        <div class="circle circle-bl"></div>
        <div class="logo-wrap">
          <div class="logo-icon">
            <ion-icon name="leaf" style="font-size:32px;color:#2f6648"></ion-icon>
          </div>
        </div>
        <h1 class="app-name">BioHealth</h1>
        <p class="app-sub">Salud Integral · Nutrición &amp; Bienestar</p>
        <div class="header-curve"></div>
      </div>

      <!-- Form area -->
      <div class="form-area">
        <h2 class="form-title">Bienvenido</h2>
        <p class="form-sub">Ingresá con las credenciales que se te proporcionaron en la sesión</p>

        <!-- Username -->
        <div class="field-group">
          <label class="field-label">Nombre de usuario</label>
          <div class="input-wrap" [class.focused]="focusedField === 'user'">
            <div class="input-icon">
              <ion-icon name="person-outline"></ion-icon>
            </div>
            <input
              type="text"
              class="field-input"
              placeholder="Ingresá tu usuario"
              [(ngModel)]="username"
              (focus)="focusedField = 'user'"
              (blur)="focusedField = null"
              autocomplete="username"
              (keyup.enter)="handleLogin()"
            />
          </div>
        </div>

        <!-- Password -->
        <div class="field-group">
          <label class="field-label">Contraseña</label>
          <div class="input-wrap" [class.focused]="focusedField === 'pass'">
            <div class="input-icon">
              <ion-icon name="lock-closed-outline"></ion-icon>
            </div>
            <input
              [type]="showPassword() ? 'text' : 'password'"
              class="field-input"
              placeholder="••••••••"
              [(ngModel)]="password"
              (focus)="focusedField = 'pass'"
              (blur)="focusedField = null"
              autocomplete="current-password"
              (keyup.enter)="handleLogin()"
            />
            <button class="eye-btn" type="button" (click)="showPassword.update(v => !v)">
              <ion-icon [name]="showPassword() ? 'eye-off-outline' : 'eye-outline'"></ion-icon>
            </button>
          </div>
        </div>

        <!-- Error -->
        @if (errorMsg()) {
          <div class="error-banner">
            <ion-icon name="alert-circle" style="color:#E05C6A"></ion-icon>
            <span>{{ errorMsg() }}</span>
          </div>
        }

        <!-- Submit -->
        <button class="login-btn" (click)="handleLogin()" [disabled]="loading()">
          @if (loading()) {
            <span class="spinner"></span>
          } @else {
            <span>Ingresar</span>
            <div class="btn-arrow">
              <ion-icon name="arrow-forward"></ion-icon>
            </div>
          }
        </button>

        <div class="divider-row">
          <div class="divider-line"></div>
          <span class="divider-text">acceso controlado</span>
          <div class="divider-line"></div>
        </div>

        <p class="footer-text">
          ¿Problemas para acceder?
          <a href="mailto:soporte@biohealth.app" class="footer-link">Contactate con soporte</a>
        </p>
      </div>
    </div>
  `,
  styles: [`
    .login-wrap {
      min-height: 100dvh;
      background: #fff9ea;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    /* ── Header ── */
    .login-header {
      background: linear-gradient(135deg, #48805f 0%, #2f6648 55%, #136967 100%);
      padding: 48px 24px 64px;
      display: flex;
      flex-direction: column;
      align-items: center;
      position: relative;
      overflow: hidden;
    }
    .circle {
      position: absolute;
      border-radius: 50%;
      background: rgba(255,255,255,0.08);
    }
    .circle-tr { width: 200px; height: 200px; top: -60px; right: -60px; }
    .circle-bl { width: 140px; height: 140px; bottom: 10px; left: -50px; background: rgba(255,255,255,0.06); }
    .logo-wrap { margin-bottom: 16px; }
    .logo-icon {
      width: 72px; height: 72px; border-radius: 22px;
      background: rgba(255,255,255,0.95);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
    }
    .app-name { font-size: 32px; font-weight: 800; color: #fff; letter-spacing: -0.5px; margin: 0; }
    .app-sub  { font-size: 13px; color: rgba(255,255,255,0.75); margin: 4px 0 0; }
    .header-curve {
      position: absolute; bottom: -1px; left: 0; right: 0; height: 32px;
      background: #fff9ea; border-radius: 32px 32px 0 0;
    }

    /* ── Form ── */
    .form-area {
      padding: 8px 28px 48px;
      display: flex; flex-direction: column; gap: 18px;
    }
    .form-title { font-size: 26px; font-weight: 800; color: #1f1c0a; letter-spacing: -0.3px; margin: 0; }
    .form-sub   { font-size: 14px; color: #136967; line-height: 1.5; margin: 0; }

    .field-group { display: flex; flex-direction: column; gap: 7px; }
    .field-label { font-size: 13px; font-weight: 600; color: #2f6648; }

    .input-wrap {
      display: flex; align-items: center;
      border: 1.5px solid rgba(47,102,72,0.20);
      border-radius: 14px; height: 54px;
      background: #fbf4d6; overflow: hidden;
      transition: border-color 0.15s, background 0.15s;
    }
    .input-wrap.focused { border-color: #2f6648; background: #f6eed1; }
    .input-icon {
      width: 50px; display: flex; align-items: center; justify-content: center;
      font-size: 18px; color: #2f6648; flex-shrink: 0;
    }
    .field-input {
      flex: 1; background: transparent; border: none; outline: none;
      font-size: 15px; color: #1f1c0a; height: 100%;
      font-family: system-ui, -apple-system, sans-serif;
    }
    .field-input::placeholder { color: rgba(75,139,116,0.5); }
    .eye-btn {
      padding: 6px 14px 6px 6px; background: transparent; border: none; cursor: pointer;
      font-size: 18px; color: #136967; display: flex; align-items: center;
    }

    .error-banner {
      display: flex; align-items: center; gap: 8px;
      padding: 11px 14px; border-radius: 12px;
      background: rgba(224,92,106,0.08); border: 1px solid rgba(224,92,106,0.2);
      font-size: 13px; color: #C94455; font-weight: 500;
    }

    .login-btn {
      display: flex; align-items: center; justify-content: center;
      height: 56px; border-radius: 16px; border: none; cursor: pointer;
      background: linear-gradient(90deg, #48805f, #2f6648);
      color: #fff; font-size: 17px; font-weight: 700;
      box-shadow: 0 6px 20px rgba(47,102,72,0.35);
      gap: 8px; padding: 0 20px;
      transition: opacity 0.15s;
    }
    .login-btn:disabled { opacity: 0.7; cursor: default; }
    .login-btn span { flex: 1; text-align: center; }
    .btn-arrow {
      width: 32px; height: 32px; border-radius: 10px; flex-shrink: 0;
      background: rgba(255,255,255,0.22);
      display: flex; align-items: center; justify-content: center; font-size: 18px;
    }
    .spinner {
      width: 22px; height: 22px; border: 3px solid rgba(255,255,255,0.3);
      border-top-color: #fff; border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .divider-row { display: flex; align-items: center; gap: 10px; }
    .divider-line { flex: 1; height: 1px; background: rgba(47,102,72,0.15); }
    .divider-text { font-size: 11px; font-weight: 500; color: #2f6648; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; }

    .footer-text  { text-align: center; font-size: 13px; color: #136967; line-height: 1.4; margin: 0; }
    .footer-link  { color: #2f6648; font-weight: 600; text-decoration: underline; }
  `],
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router      = inject(Router);

  username     = '';
  password     = '';
  focusedField: string | null = null;
  showPassword = signal(false);
  loading      = signal(false);
  errorMsg     = signal('');

  handleLogin(): void {
    if (!this.username.trim() || !this.password.trim()) {
      this.errorMsg.set('Completá todos los campos.');
      return;
    }
    this.errorMsg.set('');
    this.loading.set(true);

    this.authService.login({
      username:      this.username.trim(),
      password:      this.password,
      clinica_id:    1,
      aplicacion_id: 1,
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/tabs/inicio']);
      },
      error: () => {
        this.loading.set(false);
        this.errorMsg.set('Credenciales incorrectas. Intentá de nuevo.');
      },
    });
  }
}
