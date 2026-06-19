# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**biohealth-web** — Patient-facing Angular 21 PWA (Progressive Web App). The web counterpart to the React Native mobile app (`biohealthApp-new`). Patients access nutrition data, diet plans, exercise tracking, AI chat, and appointments. Talks to the Go backend at `https://api.koisaas.lat/api/v1`.

## Commands

```bash
npm start          # Dev server (localhost:4200)
ng serve           # Same as above
ng build           # Production build (outputs dist/)
ng test            # Run unit tests (Vitest via @angular/build:unit-test)
ng generate component pages/<name>/<name>  # Scaffold a page component
```

## Architecture

### Structure

```
src/app/
├── app.config.ts           # Root providers: router, HttpClient+interceptors, ServiceWorker
├── app.routes.ts           # All routes (lazy-loaded)
├── core/
│   ├── guards/auth.guard.ts        # authGuard / guestGuard (Signal-based)
│   ├── interceptors/auth.interceptor.ts  # Attaches Bearer token; clears auth on 401
│   ├── services/
│   │   ├── auth.service.ts         # POST /pacientes/login → populates AuthStore
│   │   ├── nutricion.service.ts    # All nutrition/exercise/progress/XP/logros endpoints
│   │   ├── chat.service.ts         # POST /nutricion/pacientes/:id/ask-ia (AI coach)
│   │   └── turnos.service.ts       # Appointment CRUD via /agenda/citas
│   └── store/auth.store.ts         # Signal-based in-memory auth state (no localStorage)
├── layout/tabs-layout/     # Shell with bottom tab bar (5 tabs) + <router-outlet>
├── pages/                  # One component per route (all standalone)
└── shared/components/      # Reusable presentational components (e.g. MacroRowComponent)
```

### Routing

All routes are lazy-loaded. Top-level structure:
- `/login` — guarded by `guestGuard`
- `/tabs/*` — guarded by `authGuard`, rendered inside `TabsLayoutComponent`
  - Visible tab bar: `inicio`, `dieta`, `ejercicio`, `docs`, `chat`
  - Accessible but not in tab bar: `perfil`, `turnos`, `registro`, `logros`, `peso`, `sintomas`
- `/**` redirects to `tabs/inicio`

### State Management

`AuthStore` (`core/store/auth.store.ts`) is the only global store. It uses Angular Signals only — no RxJS BehaviorSubjects, no NgRx, no localStorage. Auth state is lost on page refresh (by design for this app's current state).

Components read from the store with `inject(AuthStore)` and use `.pacienteId()`, `.clinicaId()`, etc. as computed signals.

### Components

Every component is **standalone** (no NgModules). Templates and styles are **inline** (no separate `.html` or `.css` files). Icons use Ionicons via `CUSTOM_ELEMENTS_SCHEMA` — always include this schema in components that use `<ion-icon>`.

### HTTP / Services

All services inject `HttpClient` directly. API responses follow two shapes:
- `ApiResponse<T>`: `{ success, message, data: T }` — services `.pipe(map(r => r.data))`
- `PaginatedResponse<T>`: `{ success, data: T[], page, page_size, total }` — services return the full object

The `authInterceptor` (functional) attaches `Authorization: Bearer <token>` on every request and calls `auth.logout()` on 401. No refresh token flow — a 401 simply logs the patient out.

The base URL `https://api.koisaas.lat/api/v1` is hardcoded in each service file as `const BASE`. Login also hardcodes `clinica_id: 1` and `aplicacion_id: 1`.

### Styling

Tailwind CSS 4 with a custom `@theme` block in `src/styles.css` defining the **Botanical Archivist** palette (same colors as the mobile app). All component styles are written as plain CSS inside the component's `styles: [...]` array using these color values directly (hex literals, not Tailwind utility classes). The global `styles.css` sets the `@theme` tokens and base resets.

Key colors: `#fff9ea` (bg), `#f6eed1` (surface), `#2f6648` (accent/green), `#1f1c0a` (text), `#136967` (teal).

### PWA

Angular Service Worker is enabled in production (`ngsw-config.json`). The app shell and JS/CSS are prefetched; image assets are lazily cached.
