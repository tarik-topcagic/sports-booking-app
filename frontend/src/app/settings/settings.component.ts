import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LanguageService } from '../../services/language.service';
import { ToastService } from '../../services/toast.service';
import { UserService, UserSettings } from '../../services/user.service';
import { Observable, Subscription, tap } from 'rxjs';
import { NavbarComponent } from '../navbar/navbar.component';
import { TranslatePipe } from '../pipes/translate.pipe';
import { SkeletonTextBlockComponent } from '../skeleton/skeleton-text-block/skeleton-text-block.component';
import { LoadErrorStateComponent } from '../load-error-state/load-error-state.component';
import { DropdownCoordinatorService } from '../../services/dropdown-coordinator.service';
import { CanComponentDeactivate } from '../guards/can-component-deactivate';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-settings',
  imports: [CommonModule, FormsModule, NavbarComponent, TranslatePipe, SkeletonTextBlockComponent, LoadErrorStateComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit, OnDestroy, CanComponentDeactivate {
  @ViewChild('languageMenuWrapper') languageMenuWrapperRef!: ElementRef<HTMLElement>;

  languages: { code: string; name: string }[] = [];
  settings: UserSettings | null = null;
  emailNotificationsEnabled = false;
  darkModeEnabled = false;
  selectedLanguage = 'bs';
  showLanguageMenu = false;
  newUsername = '';
  isChangingUsername = false;

  private coordinatorSubscription?: Subscription;
  private beforeUnloadHandlerBound = this.beforeUnloadHandler.bind(this);

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private router: Router,
    private languageService: LanguageService,
    private toastService: ToastService,
    private dropdownCoordinator: DropdownCoordinatorService,
    private confirmDialogService: ConfirmDialogService,
  ) {
    this.coordinatorSubscription = this.dropdownCoordinator.activeChanged$.subscribe((activeId) => {
      if (activeId !== this && this.showLanguageMenu) {
        this.showLanguageMenu = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.coordinatorSubscription?.unsubscribe();
    this.dropdownCoordinator.close(this);
    window.removeEventListener('beforeunload', this.beforeUnloadHandlerBound);
  }

  ngOnInit(): void {
    this.languages = this.languageService.languages;
    this.darkModeEnabled = localStorage.getItem('darkMode') === 'true';
    this.selectedLanguage = this.languageService.currentLanguage;
    this.applyDarkMode();
    window.addEventListener('beforeunload', this.beforeUnloadHandlerBound);
  }

  loadSettings = () => this.userService.getSettings().pipe(
    tap((settings) => {
      this.settings = settings;
      this.emailNotificationsEnabled = settings.emailNotificationsEnabled;
      this.selectedLanguage = settings.languagePreference || this.languageService.currentLanguage;
      this.newUsername = settings.username;
      this.languageService.setLanguage(this.selectedLanguage);
    }),
  );

  saveEmailNotifications(): void {
    this.userService
      .updateEmailNotifications(this.emailNotificationsEnabled)
      .subscribe({
        next: () => {
          if (this.settings) {
            this.settings.emailNotificationsEnabled =
              this.emailNotificationsEnabled;
          }
          this.toastService.showSuccess(
            this.languageService.translate('notificationsSaved'),
          );
        },
        error: () => {
          this.toastService.showError(this.languageService.translate('notificationsSaveError'));
        },
      });
  }

  toggleDarkMode(): void {
    localStorage.setItem('darkMode', String(this.darkModeEnabled));
    this.applyDarkMode();
  }

  changeUsername(): void {
    const username = this.newUsername.trim();

    if (!username) {
      return;
    }

    if (this.isChangingUsername) {
      return;
    }

    this.isChangingUsername = true;

    this.userService.updateUsername(username).subscribe({
      next: (response) => {
        this.isChangingUsername = false;
        const updatedUsername = response.username || username;
        if (this.settings) {
          this.settings.username = updatedUsername;
        }
        this.newUsername = updatedUsername;
        this.authService.updateCurrentUser({
          token: response.token,
          username: updatedUsername,
          fullName: response.fullName,
        });
        this.userService.refreshProfile();
        this.toastService.showSuccess(
          this.languageService.translate('usernameChanged'),
        );
      },
      error: (error) => {
        this.isChangingUsername = false;
        this.toastService.showError(
          error.error?.field === 'username'
            ? this.languageService.translate('usernameTaken')
            : this.languageService.translate('usernameChangeError'),
        );
      },
    });
  }

  logoutFromAllDevices(): void {
    this.authService.logout();
    this.router.navigate(['']);
  }

  saveLanguage(): void {
    const previousLanguage = this.languageService.currentLanguage;
    this.languageService.setLanguage(this.selectedLanguage);

    this.userService.updateLanguagePreference(this.selectedLanguage).subscribe({
      next: (response) => {
        const persistedLanguage =
          response.languagePreference || this.selectedLanguage;

        this.selectedLanguage = persistedLanguage;
        this.languageService.setLanguage(persistedLanguage);

        if (this.settings) {
          this.settings.languagePreference = persistedLanguage;
        }

        this.toastService.showSuccess(
          this.languageService.translate('languageSaved'),
        );
      },
      error: () => {
        this.selectedLanguage = previousLanguage;
        this.languageService.setLanguage(previousLanguage);
        this.toastService.showError(this.languageService.translate('languageSaveError'));
      },
    });
  }

  toggleLanguageMenu(): void {
    if (this.showLanguageMenu) {
      this.closeLanguageMenu();
      return;
    }

    this.dropdownCoordinator.open(this, this.languageMenuWrapperRef.nativeElement);
    this.showLanguageMenu = true;
  }

  selectLanguage(languageCode: string): void {
    if (this.selectedLanguage === languageCode) {
      this.closeLanguageMenu();
      return;
    }

    this.selectedLanguage = languageCode;
    this.closeLanguageMenu();
    this.saveLanguage();
  }

  get selectedLanguageName(): string {
    return (
      this.languages.find((language) => language.code === this.selectedLanguage)
        ?.name || this.languageService.getLanguageName('bs')
    );
  }

  get canSubmitUsernameChange(): boolean {
    const username = this.newUsername.trim();
    const currentUsername = this.settings?.username?.trim() || '';

    return !!username && username !== currentUsername;
  }

  get hasUnconfirmedUsernameChange(): boolean {
    const current = this.newUsername.trim();
    const original = this.settings?.username?.trim() || '';
    return current !== original;
  }

  beforeUnloadHandler(event: BeforeUnloadEvent) {
    if (this.hasUnconfirmedUsernameChange) {
      event.returnValue = this.languageService.translate('unsavedChangesConfirm');
    }
  }

  canDeactivate(): boolean | Observable<boolean> | Promise<boolean> {
    if (this.hasUnconfirmedUsernameChange) {
      return this.confirmDialogService.confirm('unsavedChangesConfirm');
    }
    return true;
  }

  private applyDarkMode(): void {
    document.body.classList.toggle('dark-mode', this.darkModeEnabled);
  }

  private closeLanguageMenu(): void {
    this.showLanguageMenu = false;
    this.dropdownCoordinator.close(this);
  }
}
