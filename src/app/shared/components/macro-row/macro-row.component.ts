import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-macro-row',
  imports: [CommonModule],
  template: `
    <div class="macro-row">
      <div class="macro-head">
        <span class="macro-label">{{ label }}</span>
        <span class="macro-value">{{ current | number:'1.0-1' }}g / {{ goal }}g</span>
      </div>
      <div class="macro-track">
        <div class="macro-fill" [style.width.%]="pct()" [style.background]="color"></div>
      </div>
    </div>
  `,
  styles: [`
    .macro-row  { display: flex; flex-direction: column; gap: 4px; }
    .macro-head { display: flex; justify-content: space-between; }
    .macro-label { font-size: 11px; font-weight: 700; letter-spacing: 0.5px; color: #2f6648; }
    .macro-value { font-size: 11px; color: #1f1c0a; font-weight: 600; }
    .macro-track { height: 7px; background: #ede8c9; border-radius: 4px; overflow: hidden; }
    .macro-fill  { height: 100%; border-radius: 4px; transition: width 0.4s ease; }
  `],
})
export class MacroRowComponent {
  @Input() label   = '';
  @Input() current = 0;
  @Input() goal    = 0;
  @Input() color   = '#2f6648';

  pct(): number {
    return this.goal > 0 ? Math.min((this.current / this.goal) * 100, 100) : 0;
  }
}
