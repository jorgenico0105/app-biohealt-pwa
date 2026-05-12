import { Component, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-tabs-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="tabs-shell">
      <main class="tabs-content">
        <router-outlet />
      </main>
      <nav class="tab-bar">
        @for (tab of tabs; track tab.path) {
          <a [routerLink]="['/tabs', tab.path]" routerLinkActive #rla="routerLinkActive" class="tab-item" [class.tab-active]="rla.isActive">
            <ion-icon [name]="rla.isActive ? tab.iconActive : tab.icon" class="tab-icon-el"></ion-icon>
            <span class="tab-label">{{ tab.label }}</span>
          </a>
        }
      </nav>
    </div>
  `,
  styles: [`
    .tabs-shell {
      display: flex;
      flex-direction: column;
      height: 100dvh;
      background: #fff9ea;
      overflow: hidden;
    }
    .tabs-content {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      -webkit-overflow-scrolling: touch;
    }
    .tab-bar {
      display: flex;
      flex-shrink: 0;
      background: #fff9ea;
      padding-bottom: env(safe-area-inset-bottom, 8px);
      height: calc(60px + env(safe-area-inset-bottom, 0px));
    }
    .tab-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      text-decoration: none;
      color: rgba(47,102,72,0.40);
      padding-top: 8px;
      transition: color 0.15s;
    }
    .tab-item.tab-active { color: #2f6648; }
    .tab-icon-el { font-size: 22px; }
    .tab-label { font-size: 11px; font-weight: 600; }
  `],
})
export class TabsLayoutComponent {
  tabs = [
    { path: 'inicio',    label: 'Inicio',    icon: 'home-outline',          iconActive: 'home' },
    { path: 'dieta',     label: 'Dieta',     icon: 'nutrition-outline',     iconActive: 'nutrition' },
    { path: 'ejercicio', label: 'Ejercicio', icon: 'fitness-outline',       iconActive: 'fitness' },
    { path: 'docs',      label: 'Docs',      icon: 'document-text-outline', iconActive: 'document-text' },
    { path: 'chat',      label: 'Chat',      icon: 'chatbubbles-outline',   iconActive: 'chatbubbles' },
  ];
}
