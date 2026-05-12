import { Component, CUSTOM_ELEMENTS_SCHEMA, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { catchError, of, map } from 'rxjs';
import { AuthStore } from '../../core/store/auth.store';

const SERVER_URL = 'https://api.koisaas.lat';
const BASE = `${SERVER_URL}/api/v1`;

interface NutricionArchivoPDF {
  id: number; clinica_id: number; medico_id: number; paciente_id?: number;
  tipo_recurso_id: number; tipo_recurso?: { id: number; nombre: string; state: string };
  titulo: string; descripcion?: string; ruta_archivo: string; state: string; creado_en: string;
}

interface NutricionTipoRecurso { id: number; nombre: string; state: string }

function getFileUrl(ruta: string): string {
  if (ruta.startsWith('http')) return ruta;
  return `${SERVER_URL}/${ruta.replace(/^\//, '')}`;
}

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)     return 'Hace un momento';
  if (diff < 3600)   return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400)  return `Hace ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} días`;
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function tipoIcon(nombre: string): string {
  const n = nombre.toLowerCase();
  if (n.includes('men') || n.includes('dieta')) return 'restaurant-outline';
  if (n.includes('bio') || n.includes('peso'))  return 'body-outline';
  if (n.includes('diag'))                        return 'medkit-outline';
  if (n.includes('receta') || n.includes('med')) return 'document-text-outline';
  return 'document-outline';
}

@Component({
  selector: 'app-docs',
  imports: [CommonModule, FormsModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h2 class="page-title">Documentos</h2>
          <p class="page-sub">De {{ doctorLabel() }}</p>
        </div>
      </div>

      <!-- Search -->
      <div class="search-wrap">
        <ion-icon name="search-outline" class="search-icon"></ion-icon>
        <input class="search-input" type="text" [(ngModel)]="search" placeholder="Buscar documentos..." />
      </div>

      <!-- Filters -->
      @if (tipoRecursos().length > 0) {
        <div class="filter-row">
          <button class="filter-chip" [class.active]="filtroTipoID() === 0" (click)="filtroTipoID.set(0)">Todos</button>
          @for (t of tipoRecursos(); track t.id) {
            <button class="filter-chip" [class.active]="filtroTipoID() === t.id" (click)="filtroTipoID.set(t.id)">{{ t.nombre }}</button>
          }
        </div>
      }

      @if (loading()) {
        <div class="loading-wrap"><div class="spinner"></div></div>
      }

      <!-- Featured -->
      @if (!loading() && featured()) {
        <div class="featured-card" (click)="openPDF(featured()!)">
          <div class="featured-icon-wrap">
            <ion-icon [name]="tipoIcon(featured()!.tipo_recurso?.nombre ?? '')"></ion-icon>
          </div>
          <div class="featured-info">
            <span class="featured-tag">Reciente</span>
            <span class="featured-title">{{ featured()!.titulo }}</span>
            @if (featured()!.descripcion) {
              <span class="featured-desc">{{ featured()!.descripcion }}</span>
            }
            <div class="featured-meta">
              <span>{{ featured()!.tipo_recurso?.nombre ?? 'Documento' }}</span>
              <span>{{ timeAgo(featured()!.creado_en) }}</span>
            </div>
          </div>
          <ion-icon name="cloud-download-outline" class="dl-icon"></ion-icon>
        </div>
      }

      <!-- Rest of docs -->
      @for (doc of rest(); track doc.id) {
        <div class="doc-row" (click)="openPDF(doc)">
          <div class="doc-icon-wrap">
            <ion-icon [name]="tipoIcon(doc.tipo_recurso?.nombre ?? '')"></ion-icon>
          </div>
          <div class="doc-info">
            <span class="doc-title">{{ doc.titulo }}</span>
            <span class="doc-meta">{{ doc.tipo_recurso?.nombre ?? 'Documento' }} · {{ timeAgo(doc.creado_en) }}</span>
          </div>
          <ion-icon name="chevron-forward" style="color:#2f6648;font-size:18px;flex-shrink:0"></ion-icon>
        </div>
      }

      @if (!loading() && filtered().length === 0) {
        <div class="card empty-card">
          <ion-icon name="document-outline" style="font-size:48px;color:#2f6648;opacity:0.5"></ion-icon>
          <p style="color:#2f6648;font-size:15px;font-weight:600;text-align:center;margin:0">Sin documentos</p>
          <p style="color:#136967;font-size:13px;text-align:center;margin:0">No hay documentos disponibles aún.</p>
        </div>
      }
    </div>
  `,
  styles: [`
    .page { padding: 16px 16px 24px; display: flex; flex-direction: column; gap: 14px; background: #fff9ea; min-height: 100%; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .page-title  { font-size: 22px; font-weight: 800; color: #1f1c0a; margin: 0; }
    .page-sub    { font-size: 13px; color: #136967; margin: 4px 0 0; }

    .search-wrap  { display: flex; align-items: center; gap: 10px; background: #f6eed1; border-radius: 14px; padding: 0 14px; height: 46px; }
    .search-icon  { font-size: 18px; color: #2f6648; flex-shrink: 0; }
    .search-input { flex: 1; background: transparent; border: none; outline: none; font-size: 14px; color: #1f1c0a; font-family: inherit; }
    .search-input::placeholder { color: rgba(47,102,72,0.5); }

    .filter-row { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; }
    .filter-row::-webkit-scrollbar { display: none; }
    .filter-chip { flex-shrink: 0; padding: 6px 14px; border-radius: 20px; border: 1.5px solid rgba(47,102,72,0.2); background: transparent; font-size: 12px; font-weight: 600; color: #2f6648; cursor: pointer; }
    .filter-chip.active { background: #2f6648; color: #fff; border-color: #2f6648; }

    .loading-wrap { display: flex; justify-content: center; padding: 48px 0; }
    .spinner { width: 28px; height: 28px; border: 3px solid rgba(47,102,72,0.2); border-top-color: #2f6648; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .featured-card { background: #f6eed1; border-radius: 20px; padding: 16px; display: flex; align-items: flex-start; gap: 14px; cursor: pointer; }
    .featured-icon-wrap { width: 56px; height: 56px; border-radius: 16px; background: rgba(47,102,72,0.1); display: flex; align-items: center; justify-content: center; font-size: 26px; color: #2f6648; flex-shrink: 0; }
    .featured-info { flex: 1; display: flex; flex-direction: column; gap: 4px; }
    .featured-tag  { font-size: 10px; font-weight: 700; letter-spacing: 0.5px; color: #136967; text-transform: uppercase; }
    .featured-title { font-size: 16px; font-weight: 800; color: #1f1c0a; line-height: 1.3; }
    .featured-desc  { font-size: 13px; color: #136967; line-height: 1.4; }
    .featured-meta  { display: flex; justify-content: space-between; font-size: 11px; color: #2f6648; font-weight: 500; }
    .dl-icon { font-size: 22px; color: #2f6648; flex-shrink: 0; }

    .doc-row { display: flex; align-items: center; gap: 12px; padding: 14px; background: #f6eed1; border-radius: 16px; cursor: pointer; }
    .doc-icon-wrap { width: 44px; height: 44px; border-radius: 12px; background: rgba(47,102,72,0.08); display: flex; align-items: center; justify-content: center; font-size: 20px; color: #2f6648; flex-shrink: 0; }
    .doc-info  { flex: 1; display: flex; flex-direction: column; gap: 3px; }
    .doc-title { font-size: 14px; font-weight: 700; color: #1f1c0a; }
    .doc-meta  { font-size: 12px; color: #136967; }

    .card { background: #f6eed1; border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .empty-card { align-items: center; padding: 32px 16px; gap: 12px; }
  `],
})
export class DocsComponent implements OnInit {
  auth = inject(AuthStore);
  private http = inject(HttpClient);

  loading      = signal(true);
  tipoRecursos = signal<NutricionTipoRecurso[]>([]);
  pdfs         = signal<NutricionArchivoPDF[]>([]);
  search       = '';
  filtroTipoID = signal<number>(0);

  doctorLabel = computed(() => {
    const nom = this.auth.doctorNombre();
    const ape = this.auth.doctorApellidos();
    return nom ? `${nom}${ape ? ' ' + ape : ''}` : 'Tu profesional';
  });

  filtered = computed(() => {
    return this.pdfs().filter(d => {
      const matchCat  = this.filtroTipoID() === 0 || d.tipo_recurso_id === this.filtroTipoID();
      const matchSrch = d.titulo.toLowerCase().includes(this.search.toLowerCase());
      return matchCat && matchSrch && d.state === 'A';
    });
  });

  featured = computed(() => this.filtered()[0] ?? null);
  rest     = computed(() => this.filtered().slice(1));

  tipoIcon(nombre: string) { return tipoIcon(nombre); }
  timeAgo(iso: string)     { return timeAgo(iso); }

  openPDF(doc: NutricionArchivoPDF): void {
    window.open(getFileUrl(doc.ruta_archivo), '_blank');
  }

  ngOnInit(): void {
    const pid = this.auth.pacienteId();

    this.http.get<{ data: NutricionTipoRecurso[] }>(`${BASE}/nutricion/tipo-recursos`)
      .pipe(catchError(() => of({ data: [] })))
      .subscribe(r => this.tipoRecursos.set(r.data ?? []));

    if (pid) {
      this.http.get<{ data: NutricionArchivoPDF[] }>(`${BASE}/nutricion/archivos-pdf/${pid}`)
        .pipe(catchError(() => of({ data: [] })), map(r => r.data ?? []))
        .subscribe(data => {
          this.pdfs.set(data);
          this.loading.set(false);
        });
    } else {
      this.loading.set(false);
    }
  }
}
