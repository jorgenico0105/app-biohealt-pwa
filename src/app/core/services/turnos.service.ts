import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';

const BASE = 'https://api.koisaas.lat/api/v1';

export interface EstadoCita { id: number; codigo: 'PE'|'CF'|'AT'|'CA'|'NA'; nombre: string; }
export interface TipoCita   { id: number; nombre: string; state: string; }
export interface Cita {
  id: number; fecha: string; hora: string; duracion_min: number;
  id_medico: number; id_paciente: number; id_clinica: number;
  tipo_cita_id: number; tipo_cita?: TipoCita;
  estado_cita_id: number; estado_cita?: EstadoCita;
  motivo?: string; notificado: boolean; state: string;
  creado_en: string; actualizado_en: string;
}
export interface CrearCitaPayload {
  fecha: string; hora: string; duracion_min?: number;
  id_medico: number; id_paciente: number; id_clinica: number;
  tipo_cita_id: number; motivo?: string;
}

interface PaginatedCitas { success: boolean; data: Cita[]; page: number; page_size: number; total_items: number; }

@Injectable({ providedIn: 'root' })
export class TurnosService {
  private http = inject(HttpClient);

  getCitasPaciente(pacienteId: number) {
    return this.http.get<PaginatedCitas>(`${BASE}/agenda/citas`, { params: { size: '100' } }).pipe(
      map(r => (r.data ?? []).filter(c => c.id_paciente === pacienteId))
    );
  }

  getTiposCita() {
    return this.http.get<{ success: boolean; data: TipoCita[] }>(`${BASE}/agenda/tipos-cita`).pipe(
      map(r => r.data ?? [])
    );
  }

  crearCita(payload: CrearCitaPayload) {
    return this.http.post<{ success: boolean; data: Cita }>(`${BASE}/agenda/citas`, payload).pipe(
      map(r => r.data)
    );
  }
}
