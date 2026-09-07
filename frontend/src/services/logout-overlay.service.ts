import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { GuardsCheckEnd, Router } from '@angular/router';
import { BehaviorSubject, filter, firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

const THEME_COLOR_META_SELECTOR = 'meta[name="theme-color"]';
const OVERLAY_LIGHT_BACKGROUND = '#fff';
const OVERLAY_DARK_BACKGROUND = '#121212';

@Injectable({
  providedIn: 'root',
})
export class LogoutOverlayService {
  private visibleSubject = new BehaviorSubject<boolean>(false);

  visible$ = this.visibleSubject.asObservable();

  private originalThemeColor: string | null | undefined;
  private originalHtmlBackground: string | undefined;
  private originalBodyBackground: string | undefined;

  constructor(
    private router: Router,
    private authService: AuthService,
    @Inject(DOCUMENT) private document: Document,
  ) {}

  show(): void {
    this.applyOverlayThemeColor();
    this.applyOverlayBodyBackground();
    this.forceReflow();
    this.visibleSubject.next(true);
  }

  hide(): void {
    this.restoreThemeColor();
    this.restoreBodyBackground();
    this.forceReflow();
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

  private currentOverlayColor(): string {
    const isDarkMode = this.document.body?.classList.contains('dark-mode') ?? false;
    return isDarkMode ? OVERLAY_DARK_BACKGROUND : OVERLAY_LIGHT_BACKGROUND;
  }

  private applyOverlayThemeColor(): void {
    this.captureOriginalThemeColorIfNeeded();
    this.replaceThemeColorMeta(this.currentOverlayColor());
  }

  private restoreThemeColor(): void {
    if (this.originalThemeColor === undefined) {
      return;
    }

    this.replaceThemeColorMeta(this.originalThemeColor);
    this.originalThemeColor = undefined;
  }

  private captureOriginalThemeColorIfNeeded(): void {
    if (this.originalThemeColor !== undefined) {
      return;
    }

    const existing = this.document.querySelector<HTMLMetaElement>(THEME_COLOR_META_SELECTOR);
    this.originalThemeColor = existing ? existing.getAttribute('content') : null;
  }

  private replaceThemeColorMeta(content: string | null): void {
    this.document.querySelector<HTMLMetaElement>(THEME_COLOR_META_SELECTOR)?.remove();

    if (content === null) {
      return;
    }

    const meta = this.document.createElement('meta');
    meta.setAttribute('name', 'theme-color');
    meta.setAttribute('content', content);
    this.document.head.appendChild(meta);
  }

  private applyOverlayBodyBackground(): void {
    const overlayColor = this.currentOverlayColor();

    if (this.originalHtmlBackground === undefined) {
      this.originalHtmlBackground = this.document.documentElement.style.backgroundColor;
    }
    if (this.originalBodyBackground === undefined) {
      this.originalBodyBackground = this.document.body?.style.backgroundColor ?? '';
    }

    this.document.documentElement.style.backgroundColor = overlayColor;
    if (this.document.body) {
      this.document.body.style.backgroundColor = overlayColor;
    }
  }

  private restoreBodyBackground(): void {
    if (this.originalHtmlBackground !== undefined) {
      this.document.documentElement.style.backgroundColor = this.originalHtmlBackground;
      this.originalHtmlBackground = undefined;
    }

    if (this.originalBodyBackground !== undefined) {
      if (this.document.body) {
        this.document.body.style.backgroundColor = this.originalBodyBackground;
      }
      this.originalBodyBackground = undefined;
    }
  }

  private forceReflow(): void {
    void this.document.body?.offsetHeight;
  }
}
