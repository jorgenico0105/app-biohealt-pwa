import { Injectable, signal, computed } from '@angular/core';

export interface AuthUser {
  token: string;
  user: string;
  pacienteId: number;
  clinicaId: number;
  aplicacionId: number;
  doctorId?: number | null;
  doctorNombre?: string | null;
  doctorApellidos?: string | null;
  doctorEspecialidad?: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthStore {
  private _token   = signal<string | null>(null);
  private _user    = signal<string | null>(null);
  private _pid     = signal<number | null>(null);
  private _cid     = signal<number | null>(null);
  private _aid     = signal<number | null>(null);
  private _docId   = signal<number | null>(null);
  private _docNom  = signal<string | null>(null);
  private _docApe  = signal<string | null>(null);
  private _docEsp  = signal<string | null>(null);

  readonly token           = this._token.asReadonly();
  readonly user            = this._user.asReadonly();
  readonly pacienteId      = this._pid.asReadonly();
  readonly clinicaId       = this._cid.asReadonly();
  readonly aplicacionId    = this._aid.asReadonly();
  readonly doctorId        = this._docId.asReadonly();
  readonly doctorNombre    = this._docNom.asReadonly();
  readonly doctorApellidos = this._docApe.asReadonly();
  readonly doctorEspecialidad = this._docEsp.asReadonly();

  readonly isLoggedIn = computed(() => !!this._token());

  setAuth(auth: AuthUser): void {
    this._token.set(auth.token);
    this._user.set(auth.user);
    this._pid.set(auth.pacienteId);
    this._cid.set(auth.clinicaId);
    this._aid.set(auth.aplicacionId);
    this._docId.set(auth.doctorId ?? null);
    this._docNom.set(auth.doctorNombre ?? null);
    this._docApe.set(auth.doctorApellidos ?? null);
    this._docEsp.set(auth.doctorEspecialidad ?? null);
  }

  logout(): void {
    this._token.set(null);
    this._user.set(null);
    this._pid.set(null);
    this._cid.set(null);
    this._aid.set(null);
    this._docId.set(null);
    this._docNom.set(null);
    this._docApe.set(null);
    this._docEsp.set(null);
  }
}
