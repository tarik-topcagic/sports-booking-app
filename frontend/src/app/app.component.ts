import { Component, OnInit } from '@angular/core';
import { Router, RouterModule, RouterOutlet } from '@angular/router';
import { ConfirmDialogComponent } from './confirm-dialog/confirm-dialog.component';
import { LanguageService } from '../services/language.service';
import { BottomGroupNavbarComponent } from './bottom-group-navbar/bottom-group-navbar.component';

@Component({
  selector: 'app-root',
  imports: [RouterModule, RouterOutlet, ConfirmDialogComponent, BottomGroupNavbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  constructor(private router: Router, private languageService: LanguageService) {
    this.applySavedDarkMode();
    this.redirectIfOnAuthPage();
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
