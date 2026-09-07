import { AsyncPipe, NgIf } from '@angular/common';
import { Component } from '@angular/core';
import { LogoutOverlayService } from '../../services/logout-overlay.service';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-logout-overlay',
  imports: [AsyncPipe, NgIf, TranslatePipe],
  templateUrl: './logout-overlay.component.html',
  styleUrl: './logout-overlay.component.scss',
})
export class LogoutOverlayComponent {
  visible$;

  constructor(private logoutOverlayService: LogoutOverlayService) {
    this.visible$ = this.logoutOverlayService.visible$;
  }
}
