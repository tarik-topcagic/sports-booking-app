import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, RendererFactory2, Renderer2 } from '@angular/core';
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

  private readonly renderer: Renderer2;
  private originalThemeColor: string | null | undefined;
  private themeColorMetaCreatedByUs = false;

  constructor(
    private router: Router,
    private authService: AuthService,
    @Inject(DOCUMENT) private document: Document,
    rendererFactory: RendererFactory2,
  ) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  show(): void {
    this.applyOverlayThemeColor();
    this.visibleSubject.next(true);
  }

  hide(): void {
    this.restoreThemeColor();
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
  private applyOverlayThemeColor(): void {
    const meta = this.getOrCreateThemeColorMeta();
    const isDarkMode = this.document.body?.classList.contains('dark-mode') ?? false;
    const overlayColor = isDarkMode ? OVERLAY_DARK_BACKGROUND : OVERLAY_LIGHT_BACKGROUND;
    this.renderer.setAttribute(meta, 'content', overlayColor);
  }

  private restoreThemeColor(): void {
    const meta = this.document.querySelector<HTMLMetaElement>(THEME_COLOR_META_SELECTOR);
    if (!meta || this.originalThemeColor === undefined) {
      return;
    }

    if (this.originalThemeColor === null) {
      if (this.themeColorMetaCreatedByUs) {
        this.renderer.removeChild(this.document.head, meta);
        this.themeColorMetaCreatedByUs = false;
      }
    } else {
      this.renderer.setAttribute(meta, 'content', this.originalThemeColor);
    }

    this.originalThemeColor = undefined;
  }

  private getOrCreateThemeColorMeta(): HTMLMetaElement {
    const existing = this.document.querySelector<HTMLMetaElement>(THEME_COLOR_META_SELECTOR);

    if (existing) {
      if (this.originalThemeColor === undefined) {
        this.originalThemeColor = existing.getAttribute('content');
      }
      return existing;
    }

    const meta = this.renderer.createElement('meta') as HTMLMetaElement;
    this.renderer.setAttribute(meta, 'name', 'theme-color');
    this.renderer.appendChild(this.document.head, meta);
    this.themeColorMetaCreatedByUs = true;
    this.originalThemeColor = null;
    return meta;
  }
}
