import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'tabs/inicio', pathMatch: 'full' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/tabs-layout/tabs-layout.component').then(m => m.TabsLayoutComponent),
    children: [
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
      {
        path: 'inicio',
        loadComponent: () => import('./pages/inicio/inicio.component').then(m => m.InicioComponent),
      },
      {
        path: 'dieta',
        loadComponent: () => import('./pages/dieta/dieta.component').then(m => m.DietaComponent),
      },
      {
        path: 'ejercicio',
        loadComponent: () => import('./pages/ejercicio/ejercicio.component').then(m => m.EjercicioComponent),
      },
      {
        path: 'docs',
        loadComponent: () => import('./pages/docs/docs.component').then(m => m.DocsComponent),
      },
      {
        path: 'chat',
        loadComponent: () => import('./pages/chat/chat.component').then(m => m.ChatComponent),
      },
      {
        path: 'perfil',
        loadComponent: () => import('./pages/perfil/perfil.component').then(m => m.PerfilComponent),
      },
      {
        path: 'turnos',
        loadComponent: () => import('./pages/turnos/turnos.component').then(m => m.TurnosComponent),
      },
      {
        path: 'registro',
        loadComponent: () => import('./pages/registro/registro.component').then(m => m.RegistroComponent),
      },
      {
        path: 'logros',
        loadComponent: () => import('./pages/logros/logros.component').then(m => m.LogrosComponent),
      },
      {
        path: 'peso',
        loadComponent: () => import('./pages/peso/peso.component').then(m => m.PesoComponent),
      },
      {
        path: 'sintomas',
        loadComponent: () => import('./pages/sintomas/sintomas.component').then(m => m.SintomasComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'tabs/inicio' },
];
