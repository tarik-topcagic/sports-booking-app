import { Component, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { NavigationEnd, Router, RouterModule, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { LanguageService } from '../services/language.service';
import { BottomGroupNavbarComponent } from './bottom-group-navbar/bottom-group-navbar.component';
import { NavbarComponent } from './navbar/navbar.component';

const HIDDEN_NAVBAR_PATHS = ['/', '/login', '/register'];

@Component({
  selector: 'app-root',
  imports: [NgIf, RouterModule, RouterOutlet, ConfirmDialogComponent, BottomGroupNavbarComponent, NavbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  showNavbar = !HIDDEN_NAVBAR_PATHS.includes(window.location.pathname);

  constructor(private router: Router, private languageService: LanguageService) {
    this.applySavedDarkMode();
    this.redirectIfOnAuthPage();

    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.showNavbar = !HIDDEN_NAVBAR_PATHS.includes(this.router.url.split('?')[0]);
    });
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
