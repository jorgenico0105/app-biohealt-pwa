import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';

const BASE = 'https://api.koisaas.lat/api/v1';
const p = (id: number) => `${BASE}/nutricion/pacientes/${id}`;

// ── Response wrappers ──────────────────────────────────────────────────────────
export interface ApiResponse<T> { success: boolean; message: string; data: T }
export interface PaginatedResponse<T> { success: boolean; data: T[]; page: number; page_size: number; total: number }

// ── Types (mirrors nutricionService.ts from mobile) ────────────────────────────
export type EstadoDieta = 'ACTIVA' | 'COMPLETADA' | 'CANCELADA' | 'PAUSADA';
export type EstadoMenu  = 'PENDIENTE' | 'ACTIVO' | 'COMPLETADO';

export interface NutricionDieta {
  id: number; paciente_id: number; medico_id: number; nombre: string;
  descripcion?: string; objetivo?: string; resultado_esperado?: string;
  fecha_inicio: string; duracion_dias: number; num_comidas: number;
  fecha_fin?: string; calorias_dia_objetivo?: number; proteinas_g_dia?: number;
  carbohidratos_g_dia?: number; grasas_g_dia?: number; fibra_g_dia?: number;
  estado: EstadoDieta; creado_en: string;
}

export interface NutricionAlimento {
  id: number; nombre: string; descripcion?: string; categoria?: string;
  gramos_porcion: number; calorias: number; proteinas_g: number;
  carbohidratos_g: number; grasas_g: number; fibra_g?: number;
  unidad?: boolean; gramos_unidad?: number; medida?: string;
}

export interface NutricionMenuAlimento {
  id: number; menu_detalle_id: number; alimento_id?: number;
  gramos_asignados: number; calorias_calc?: number; proteinas_g_calc?: number;
  carbohidratos_g_calc?: number; grasas_g_calc?: number; observacion?: string;
  Alimento?: NutricionAlimento;
}

export interface NutricionMenuDetalle {
  id: number; menu_id: number; tipo_comida_id: number; dia_numero: number;
  nombre_comida?: string; instrucciones?: string; nombre_receta?: string;
  calorias_total?: number; proteinas_g_total?: number;
  carbohidratos_g_total?: number; grasas_g_total?: number;
  state?: string; alimentos?: NutricionMenuAlimento[];
}

export interface NutricionMenu {
  id: number; dieta_paciente_id: number; semana_numero: number;
  fecha_inicio: string; fecha_fin: string; nombre?: string; notas?: string;
  estado: EstadoMenu; detalles?: NutricionMenuDetalle[];
}

export interface NutricionRegistroComida {
  id: number; paciente_id: number; fecha: string; tipo_comida_id: number;
  menu_detalle_id?: number; fuera_de_plan: boolean; descripcion_libre?: string;
  calorias_consumidas?: number; proteinas_g?: number; carbohidratos_g?: number;
  grasas_g?: number; porcentaje_cumplido?: number; notas?: string;
  estado: string; creado_en: string;
}

export interface NutricionRegistroEjercicio {
  id: number; paciente_id: number; fecha: string; nombre_libre?: string;
  duracion_min_real?: number; series_real?: number; repeticiones_real?: number;
  peso_kg_real?: number; calorias_quemadas?: number;
  frecuencia_cardiaca_max?: number; nivel_esfuerzo?: number;
  notas?: string; creado_en: string;
}

export interface ResumenDiario {
  fecha: string; calorias_objetivo: number; calorias_consumidas: number;
  calorias_quemadas: number; proteinas_g: number; carbohidratos_g: number;
  grasas_g: number; porcentaje_cumplimiento: number;
  registros_comida: NutricionRegistroComida[];
  registros_ejercicio: NutricionRegistroEjercicio[];
}

export interface NutricionXP {
  paciente_id: number; xp_total: number; nivel: number;
  racha_actual: number; racha_maxima: number; ultimo_registro: string;
}

export interface NutricionLogro {
  id: number; codigo: string; nombre: string; descripcion?: string;
  icono?: string; categoria?: string; puntos_xp: number; obtenido_en?: string;
}

export type TipoSintoma = 'GASTROINTESTINAL' | 'ENERGETICO' | 'DIGESTIVO' | 'OTRO';
export interface NutricionSintoma {
  id: number; paciente_id: number; fecha: string; tipo?: TipoSintoma;
  descripcion: string; intensidad?: number; alimento_posible?: string; creado_en: string;
}
export interface CrearSintomaPayload {
  fecha: string; tipo?: TipoSintoma; descripcion: string;
  intensidad?: number; alimento_posible?: string;
}

export interface NutricionProgreso {
  id: number; paciente_id: number; fecha: string; dieta_paciente_id?: number;
  peso_kg?: number; altura_cm?: number; imc?: number; grasa_corporal_pct?: number;
  masa_muscular_kg?: number; cintura_cm?: number; cadera_cm?: number;
  pecho_cm?: number; brazo_cm?: number; muslo_cm?: number;
  calorias_consumidas_dia?: number; pct_cumplimiento_dieta?: number;
  pct_cumplimiento_ejercicio?: number; energia_nivel?: number;
  sueno_horas?: number; hidratacion_litros?: number; notas?: string; creado_en: string;
}
export interface CrearProgresoPayload {
  fecha: string; peso_kg: number; altura_cm?: number; imc?: number;
  grasa_corporal_pct?: number; masa_muscular_kg?: number; cintura_cm?: number;
  cadera_cm?: number; pecho_cm?: number; brazo_cm?: number; muslo_cm?: number;
  calorias_consumidas_dia?: number; pct_cumplimiento_dieta?: number;
  pct_cumplimiento_ejercicio?: number; energia_nivel?: number;
  sueno_horas?: number; hidratacion_litros?: number; notas?: string;
}

export interface CrearRegistroComidaPayload {
  fecha: string; tipo_comida_id: number; menu_detalle_id?: number;
  fuera_de_plan: boolean; descripcion_libre?: string;
  calorias_consumidas?: number; proteinas_g?: number;
  carbohidratos_g?: number; grasas_g?: number;
}
export interface AgregarAlimentoPayload {
  alimento_id: number; gramos_consumidos: number;
}

export interface NutricionEjercicioCatalogo {
  id: number; nombre: string; descripcion?: string; categoria?: string;
  grupo_muscular?: string; nivel?: string; calorias_por_hora?: number; unidad_medida?: string;
}

export interface NutricionEjercicioPaciente {
  id: number; paciente_id: number; medico_id: number; ejercicio_id: number;
  ejercicio?: NutricionEjercicioCatalogo; dia_numero?: number; dia_semana?: string;
  duracion_min?: number; series?: number; repeticiones?: number;
  peso_kg?: number; calorias_estimadas?: number; instrucciones?: string;
  estado: string;
}

export interface CrearRegistroEjercicioPayload {
  fecha: string; ejercicio_paciente_id?: number; ejercicio_id?: number;
  nombre_libre?: string; duracion_min_real?: number; series_real?: number;
  repeticiones_real?: number; peso_kg_real?: number; calorias_quemadas?: number;
  frecuencia_cardiaca_max?: number; nivel_esfuerzo?: number; notas?: string;
}

@Injectable({ providedIn: 'root' })
export class NutricionService {
  private http = inject(HttpClient);

  getDietas(pid: number) {
    return this.http.get<PaginatedResponse<NutricionDieta>>(`${p(pid)}/dietas`).pipe(map(r => r));
  }

  getMenu(pid: number, menuId: number) {
    return this.http.get<ApiResponse<NutricionMenu>>(`${p(pid)}/menus/${menuId}`).pipe(map(r => r.data));
  }

  getMenus(pid: number, dietaId: number) {
    return this.http.get<PaginatedResponse<NutricionMenu>>(`${p(pid)}/dietas/${dietaId}/menus`).pipe(map(r => r));
  }

  getResumenDiario(pid: number, fecha?: string) {
    const url = `${p(pid)}/resumen-diario${fecha ? `?fecha=${fecha}` : ''}`;
    return this.http.get<ApiResponse<ResumenDiario>>(url).pipe(map(r => r.data));
  }

  getXP(pid: number) {
    return this.http.get<ApiResponse<NutricionXP>>(`${p(pid)}/xp`).pipe(map(r => r.data));
  }

  getEjerciciosAsignados(pid: number) {
    return this.http.get<PaginatedResponse<NutricionEjercicioPaciente>>(`${p(pid)}/ejercicios`).pipe(map(r => r));
  }

  getRegistrosEjercicio(pid: number) {
    return this.http.get<PaginatedResponse<NutricionRegistroEjercicio>>(`${p(pid)}/registros-ejercicio`).pipe(map(r => r));
  }

  crearRegistroEjercicio(pid: number, payload: CrearRegistroEjercicioPayload) {
    return this.http.post<ApiResponse<NutricionRegistroEjercicio>>(`${p(pid)}/registros-ejercicio`, payload).pipe(map(r => r.data));
  }

  getAlimentos(search?: string) {
    const url = `${BASE}/nutricion/alimentos${search ? `?search=${encodeURIComponent(search)}` : ''}`;
    return this.http.get<PaginatedResponse<NutricionAlimento>>(url).pipe(map(r => r));
  }

  getRegistrosComida(pid: number, fecha?: string) {
    const url = `${p(pid)}/registros-comida${fecha ? `?fecha=${fecha}` : ''}`;
    return this.http.get<PaginatedResponse<NutricionRegistroComida>>(url).pipe(map(r => r));
  }

  crearRegistroComida(pid: number, payload: CrearRegistroComidaPayload) {
    return this.http.post<ApiResponse<NutricionRegistroComida>>(`${p(pid)}/registros-comida`, payload).pipe(map(r => r.data));
  }

  agregarAlimentoRegistro(pid: number, registroId: number, payload: AgregarAlimentoPayload) {
    return this.http.post(`${p(pid)}/registros-comida/${registroId}/alimentos`, payload);
  }

  getProgreso(pid: number) {
    return this.http.get<PaginatedResponse<NutricionProgreso>>(`${p(pid)}/progreso`).pipe(map(r => r));
  }

  crearProgreso(pid: number, payload: CrearProgresoPayload) {
    return this.http.post<ApiResponse<NutricionProgreso>>(`${p(pid)}/progreso`, payload).pipe(map(r => r.data));
  }

  getLogros(pid: number) {
    return this.http.get<PaginatedResponse<NutricionLogro>>(`${p(pid)}/logros`).pipe(map(r => r));
  }

  crearSintoma(pid: number, payload: CrearSintomaPayload) {
    return this.http.post<ApiResponse<NutricionSintoma>>(`${p(pid)}/sintomas`, payload).pipe(map(r => r.data));
  }
}
