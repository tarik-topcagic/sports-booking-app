import { Injectable } from '@angular/core';
import { GuardsCheckEnd, Router } from '@angular/router';
import { BehaviorSubject, filter, firstValueFrom } from 'rxjs';
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
    const navigatePromise = this.router.navigate(['']);
    const navId = this.router.getCurrentNavigation()?.id;

    if (navId == null) {
      console.warn('LogoutOverlayService: no current navigation id available; showing overlay immediately.');
      return this.showAndFinishLogout(navigatePromise);
    }

    const guardsEnd = await firstValueFrom(
      this.router.events.pipe(
        filter((event): event is GuardsCheckEnd => event instanceof GuardsCheckEnd && event.id === navId),
      ),
    );

    if (!guardsEnd.shouldActivate) {
      await navigatePromise;
      return;
    }

    return this.showAndFinishLogout(navigatePromise);
  }

  private async showAndFinishLogout(navigatePromise: Promise<boolean>): Promise<void> {
    this.show();

    try {
      const [navigated] = await Promise.all([navigatePromise, this.delay(600)]);
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
