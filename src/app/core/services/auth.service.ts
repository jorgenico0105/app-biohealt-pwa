import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { AuthStore } from '../store/auth.store';

const BASE = 'https://api.koisaas.lat/api/v1';

interface LoginPayload {
  username: string;
  password: string;
  clinica_id: number;
  aplicacion_id: number;
}

interface LoginResponse {
  succes: boolean;
  message: string;
  data: {
    access_token: string;
    token_type: string;
    expires_in: number;
    paciente_id: number;
    clinica_id: number;
    aplicacion_id: number;
    username: string;
    Medico?: {
      id: number;
      nombre: string;
      apellidos: string;
      foto?: string | null;
      especialidad?: string | null;
    } | null;
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private auth = inject(AuthStore);

  login(payload: LoginPayload) {
    return this.http.post<LoginResponse>(`${BASE}/pacientes/login`, payload).pipe(
      tap((res) => {
        if (res.data?.access_token) {
          this.auth.setAuth({
            token:              res.data.access_token,
            user:               res.data.username,
            pacienteId:         res.data.paciente_id,
            clinicaId:          res.data.clinica_id,
            aplicacionId:       res.data.aplicacion_id,
            doctorId:           res.data.Medico?.id ?? null,
            doctorNombre:       res.data.Medico?.nombre ?? null,
            doctorApellidos:    res.data.Medico?.apellidos ?? null,
            doctorEspecialidad: res.data.Medico?.especialidad ?? null,
          });
        }
      })
    );
  }

  logout(): void {
    this.auth.logout();
  }
}
