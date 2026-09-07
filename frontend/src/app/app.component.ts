import { Component, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { LanguageService } from '../services/language.service';
import { BottomGroupNavbarComponent } from './bottom-group-navbar/bottom-group-navbar.component';
import { NavbarComponent } from './navbar/navbar.component';
import { LogoutOverlayComponent } from './logout-overlay/logout-overlay.component';
import { LogoutOverlayService } from '../services/logout-overlay.service';

const HIDDEN_NAVBAR_PATHS = ['/', '/login', '/register'];
const ONBOARDING_PROFILE_EDIT_PATH = '/profile/edit';

@Component({
  selector: 'app-root',
  imports: [NgIf, RouterModule, RouterOutlet, ConfirmDialogComponent, BottomGroupNavbarComponent, NavbarComponent, LogoutOverlayComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  showNavbar: boolean;
  isOnboardingProfileEdit: boolean;

  private isRouteNavbarVisible: boolean;
  private isLogoutOverlayVisible = false;

  constructor(
    private router: Router,
    private languageService: LanguageService,
    private logoutOverlayService: LogoutOverlayService,
  ) {
    this.applySavedDarkMode();
    this.redirectIfOnAuthPage();

    this.isOnboardingProfileEdit = this.computeIsOnboardingProfileEdit(window.location.pathname, window.location.search);
    this.isRouteNavbarVisible = !HIDDEN_NAVBAR_PATHS.includes(window.location.pathname) && !this.isOnboardingProfileEdit;
    this.showNavbar = this.isRouteNavbarVisible;

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      const [path, query] = this.router.url.split('?');
      this.isOnboardingProfileEdit = this.computeIsOnboardingProfileEdit(path, query ?? '');
      this.isRouteNavbarVisible = !HIDDEN_NAVBAR_PATHS.includes(path) && !this.isOnboardingProfileEdit;
      this.updateShowNavbar();
    });

    this.logoutOverlayService.visible$.subscribe((isVisible) => {
      this.isLogoutOverlayVisible = isVisible;
      this.updateShowNavbar();
    });
  }

  private updateShowNavbar(): void {
    this.showNavbar = this.isRouteNavbarVisible && !this.isLogoutOverlayVisible;
  }

  private computeIsOnboardingProfileEdit(path: string, queryString: string): boolean {
    if (path !== ONBOARDING_PROFILE_EDIT_PATH) {
      return false;
    }
    return new URLSearchParams(queryString).get('onboarding') === 'true';
  }

  ngOnInit(): void {
    this.languageService.initializeLanguage().subscribe();
  }

  private applySavedDarkMode(): void {
    document.body.classList.toggle(
      'dark-mode',
      localStorage.getItem('darkMode') === 'true',
    );
  }

  private redirectIfOnAuthPage(): void {
    const authRoutes = ['/login', '/register'];
    if (authRoutes.includes(window.location.pathname)) {
      this.router.navigate(['/']);
    }
  }
}
