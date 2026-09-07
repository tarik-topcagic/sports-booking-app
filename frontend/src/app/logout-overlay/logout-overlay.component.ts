import { Component, ElementRef, OnDestroy, Renderer2, ViewChild } from '@angular/core';
import { Subscription } from 'rxjs';
import { LogoutOverlayService } from '../../services/logout-overlay.service';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-logout-overlay',
  imports: [TranslatePipe],
  templateUrl: './logout-overlay.component.html',
  styleUrl: './logout-overlay.component.scss',
})
export class LogoutOverlayComponent implements OnDestroy {
  @ViewChild('overlayEl') overlayElRef?: ElementRef<HTMLElement>;

  isVisible = false;

  private visibleSubscription: Subscription;
  private readonly viewportResizeHandler = () => this.syncOverlaySizeToVisualViewport();

  constructor(
    private logoutOverlayService: LogoutOverlayService,
    private renderer: Renderer2,
  ) {
    this.visibleSubscription = this.logoutOverlayService.visible$.subscribe((isVisible) => {
      this.isVisible = isVisible;

      if (isVisible) {
        this.attachViewportListener();
      } else {
        this.detachViewportListener();
      }
    });
  }

  ngOnDestroy(): void {
    this.visibleSubscription.unsubscribe();
    this.detachViewportListener();
  }

  private attachViewportListener(): void {
    if (typeof window === 'undefined' || !window.visualViewport) {
      return;
    }
    window.visualViewport.addEventListener('resize', this.viewportResizeHandler);
    this.syncOverlaySizeToVisualViewport();
  }

  private detachViewportListener(): void {
    if (typeof window === 'undefined' || !window.visualViewport) {
      return;
    }

    window.visualViewport.removeEventListener('resize', this.viewportResizeHandler);
  }

  private syncOverlaySizeToVisualViewport(): void {
    const el = this.overlayElRef?.nativeElement;
    const viewport = typeof window !== 'undefined' ? window.visualViewport : null;

    if (!el || !viewport) {
      return;
    }

    this.renderer.setStyle(el, 'height', `${viewport.height}px`);
    this.renderer.setStyle(el, 'width', `${viewport.width}px`);
  }
}
