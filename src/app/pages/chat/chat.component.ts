import { Component, CUSTOM_ELEMENTS_SCHEMA, signal, inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { catchError, of } from 'rxjs';
import { AuthStore } from '../../core/store/auth.store';
import { ChatService, AiMessage } from '../../core/services/chat.service';

function formatTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

const SUGGESTED = [
  '¿Qué puedo comer para aumentar la proteína?',
  '¿Cómo dividir mis macros para bajar de peso?',
  '¿Qué alimentos me ayudan a dormir mejor?',
  '¿Cuánta agua debo tomar al día?',
];

@Component({
  selector: 'app-chat',
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="chat-shell">
      <!-- Header -->
      <div class="chat-header">
        <div class="bot-avatar"><ion-icon name="sparkles" style="font-size:20px;color:#fff"></ion-icon></div>
        <div class="header-info">
          <span class="header-title">Asistente BioHealth</span>
          <span class="header-sub">Powered by IA</span>
        </div>
        <button class="clear-btn" (click)="clearMessages()" title="Limpiar chat">
          <ion-icon name="trash-outline"></ion-icon>
        </button>
      </div>

      <!-- Messages -->
      <div class="messages-area" #messagesArea>
        <!-- Welcome -->
        @if (messages().length === 0 && !pendingText()) {
          <div class="welcome-wrap">
            <div class="welcome-icon"><ion-icon name="sparkles" style="font-size:32px;color:#2f6648"></ion-icon></div>
            <h3 class="welcome-title">¿En qué puedo ayudarte?</h3>
            <p class="welcome-sub">Preguntame sobre tu dieta, ejercicio, nutrición o bienestar.</p>
            <div class="suggested-list">
              @for (s of suggested; track s) {
                <button class="suggested-chip" (click)="sendMessage(s)">{{ s }}</button>
              }
            </div>
          </div>
        }

        <!-- Message bubbles -->
        @for (msg of messages(); track msg.createdAt) {
          <div class="bubble-wrap" [class.user]="msg.role === 'user'">
            @if (msg.role === 'assistant') {
              <div class="bot-avatar-sm"><ion-icon name="sparkles" style="font-size:14px;color:#fff"></ion-icon></div>
            }
            <div class="bubble" [class.user]="msg.role === 'user'" [class.bot]="msg.role === 'assistant'">
              <p class="bubble-text">{{ msg.content }}</p>
              <span class="bubble-time">{{ formatTime(msg.createdAt) }}</span>
            </div>
          </div>
        }

        <!-- Pending bubble -->
        @if (pendingText()) {
          <div class="bubble-wrap user">
            <div class="bubble user">
              <p class="bubble-text">{{ pendingText() }}</p>
            </div>
          </div>
          <div class="bubble-wrap">
            <div class="bot-avatar-sm"><ion-icon name="sparkles" style="font-size:14px;color:#fff"></ion-icon></div>
            <div class="bubble bot typing">
              <span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>
            </div>
          </div>
        }

        <!-- Error -->
        @if (lastError()) {
          <div class="error-banner">
            <ion-icon name="alert-circle-outline"></ion-icon>
            <span>{{ lastError() }}</span>
          </div>
        }
      </div>

      <!-- Input bar -->
      <div class="input-bar">
        <div class="input-wrap" [class.disabled]="loading()">
          <textarea
            class="chat-input"
            [(ngModel)]="inputText"
            placeholder="Escribí tu pregunta..."
            rows="1"
            (keydown.enter)="onEnter($event)"
            [disabled]="loading()"
          ></textarea>
          <button class="send-btn" (click)="sendMessage(inputText)" [disabled]="loading() || !inputText.trim()">
            @if (loading()) {
              <span class="spinner-sm"></span>
            } @else {
              <ion-icon name="send"></ion-icon>
            }
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .chat-shell { display: flex; flex-direction: column; height: 100%; background: #fff9ea; }

    /* Header */
    .chat-header { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: #f6eed1; flex-shrink: 0; }
    .bot-avatar  { width: 40px; height: 40px; border-radius: 14px; background: linear-gradient(135deg, #48805f, #2f6648); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .header-info { flex: 1; display: flex; flex-direction: column; }
    .header-title { font-size: 15px; font-weight: 800; color: #1f1c0a; }
    .header-sub   { font-size: 11px; color: #136967; font-weight: 500; }
    .clear-btn { background: transparent; border: none; font-size: 20px; color: #2f6648; cursor: pointer; padding: 4px; display: flex; align-items: center; }

    /* Messages */
    .messages-area { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; -webkit-overflow-scrolling: touch; }

    /* Welcome */
    .welcome-wrap  { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 32px 16px; }
    .welcome-icon  { width: 72px; height: 72px; border-radius: 22px; background: rgba(47,102,72,0.1); display: flex; align-items: center; justify-content: center; }
    .welcome-title { font-size: 20px; font-weight: 800; color: #1f1c0a; margin: 0; text-align: center; }
    .welcome-sub   { font-size: 14px; color: #136967; margin: 0; text-align: center; }
    .suggested-list { display: flex; flex-direction: column; gap: 8px; width: 100%; margin-top: 8px; }
    .suggested-chip { background: #f6eed1; border: 1.5px solid rgba(47,102,72,0.2); border-radius: 14px; padding: 12px 16px; font-size: 13px; color: #2f6648; font-weight: 600; cursor: pointer; text-align: left; font-family: inherit; }

    /* Bubbles */
    .bubble-wrap { display: flex; align-items: flex-end; gap: 8px; }
    .bubble-wrap.user { flex-direction: row-reverse; }
    .bot-avatar-sm { width: 28px; height: 28px; border-radius: 10px; background: linear-gradient(135deg, #48805f, #2f6648); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .bubble { max-width: 82%; padding: 10px 14px; border-radius: 18px; display: flex; flex-direction: column; gap: 4px; }
    .bubble.bot  { background: #f6eed1; border-bottom-left-radius: 4px; }
    .bubble.user { background: #2f6648; border-bottom-right-radius: 4px; }
    .bubble-text { font-size: 14px; line-height: 1.5; margin: 0; white-space: pre-wrap; word-break: break-word; }
    .bubble.bot .bubble-text  { color: #1f1c0a; }
    .bubble.user .bubble-text { color: #fff; }
    .bubble-time { font-size: 10px; align-self: flex-end; }
    .bubble.bot  .bubble-time { color: #136967; }
    .bubble.user .bubble-time { color: rgba(255,255,255,0.6); }

    /* Typing */
    .bubble.typing { gap: 0; padding: 14px 16px; flex-direction: row; align-items: center; gap: 4px; }
    .typing-dot { width: 7px; height: 7px; border-radius: 50%; background: #2f6648; animation: bounce 1.2s infinite ease-in-out; }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }

    /* Error */
    .error-banner { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-radius: 14px; background: rgba(186,26,26,0.08); border: 1px solid rgba(186,26,26,0.2); font-size: 13px; color: #ba1a1a; font-weight: 500; }

    /* Input */
    .input-bar { flex-shrink: 0; padding: 10px 16px; padding-bottom: max(10px, env(safe-area-inset-bottom, 10px)); background: #f6eed1; }
    .input-wrap { display: flex; align-items: flex-end; gap: 10px; background: #fff9ea; border: 1.5px solid rgba(47,102,72,0.2); border-radius: 18px; padding: 8px 8px 8px 14px; }
    .input-wrap.disabled { opacity: 0.6; }
    .chat-input { flex: 1; background: transparent; border: none; outline: none; font-size: 14px; color: #1f1c0a; font-family: inherit; resize: none; max-height: 120px; line-height: 1.5; padding: 4px 0; }
    .chat-input::placeholder { color: rgba(47,102,72,0.5); }
    .send-btn { width: 38px; height: 38px; border-radius: 12px; background: #2f6648; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 18px; color: #fff; flex-shrink: 0; }
    .send-btn:disabled { opacity: 0.5; cursor: default; }
    .spinner-sm { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class ChatComponent implements AfterViewChecked {
  auth        = inject(AuthStore);
  private chatSvc = inject(ChatService);

  @ViewChild('messagesArea') messagesArea!: ElementRef<HTMLDivElement>;

  messages    = signal<AiMessage[]>([]);
  pendingText = signal<string | null>(null);
  loading     = signal(false);
  lastError   = signal<string | null>(null);
  inputText   = '';
  suggested   = SUGGESTED;

  private shouldScroll = false;

  formatTime(iso: string) { return formatTime(iso); }

  clearMessages(): void {
    this.messages.set([]);
    this.lastError.set(null);
  }

  onEnter(e: Event): void {
    const ke = e as KeyboardEvent;
    if (!ke.shiftKey) {
      e.preventDefault();
      this.sendMessage(this.inputText);
    }
  }

  sendMessage(text: string): void {
    const trimmed = text.trim();
    if (!trimmed || this.loading()) return;

    this.inputText = '';
    this.lastError.set(null);
    this.pendingText.set(trimmed);
    this.loading.set(true);
    this.shouldScroll = true;

    const pid = this.auth.pacienteId() ?? 0;
    this.chatSvc.sendPrompt(pid, trimmed).pipe(
      catchError((err) => {
        const isTimeout = err?.status === 0 || err?.message?.includes('timeout');
        this.lastError.set(
          isTimeout
            ? 'La IA tardó demasiado en responder. Intentá de nuevo.'
            : 'No se pudo conectar. Verificá tu conexión.'
        );
        return of([]);
      })
    ).subscribe(updated => {
      this.pendingText.set(null);
      if (Array.isArray(updated) && updated.length > 0) {
        this.messages.set(updated);
      }
      this.loading.set(false);
      this.shouldScroll = true;
    });
  }

  ngAfterViewChecked(): void {
    if (this.shouldScroll && this.messagesArea) {
      const el = this.messagesArea.nativeElement;
      el.scrollTop = el.scrollHeight;
      this.shouldScroll = false;
    }
  }
}
