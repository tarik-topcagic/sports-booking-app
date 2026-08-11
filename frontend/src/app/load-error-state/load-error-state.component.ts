import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-load-error-state',
  imports: [TranslatePipe],
  templateUrl: './load-error-state.component.html',
})
export class LoadErrorStateComponent {
  @Input() message = '';
  @Input() retryLabel: string | null = null;
  @Output() retry = new EventEmitter<void>();
}
