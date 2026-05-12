import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext, HttpContextToken } from '@angular/common/http';
import { map } from 'rxjs';

export const TIMEOUT_MS = new HttpContextToken<number>(() => 10_000);

const BASE = 'https://api.koisaas.lat/api/v1';

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  private http = inject(HttpClient);

  sendPrompt(pacienteId: number, prompt: string) {
    return this.http
      .post<{ success: boolean; data: AiMessage[] }>(
        `${BASE}/nutricion/pacientes/${pacienteId}/ask-ia`,
        { prompt },
        { context: new HttpContext().set(TIMEOUT_MS, 90_000) }
      )
      .pipe(map(r => r.data ?? []));
  }
}
