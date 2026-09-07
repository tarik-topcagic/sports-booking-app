import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class LogoutOverlayService {
  private visibleSubject = new BehaviorSubject<boolean>(false);

  visible$ = this.visibleSubject.asObservable();

  constructor(
    private router: Router,
    private authService: AuthService,
  ) {}

  show(): void {
    this.visibleSubject.next(true);
  }

  hide(): void {
    this.visibleSubject.next(false);
  }

  async performLogout(): Promise<void> {
    this.show();

    try {
      const [navigated] = await Promise.all([this.router.navigate(['']), this.delay(600)]);
      if (navigated) {
        this.authService.logout();
      }
    } finally {
      this.hide();
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
