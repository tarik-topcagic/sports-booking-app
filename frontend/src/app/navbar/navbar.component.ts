import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, HostListener } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { NgClass, NgIf } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { UserService } from '../../services/user.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { Subscription } from 'rxjs';
import { NotificationDropdownComponent } from '../notification-dropdown/notification-dropdown.component';
import { MessageDropdownComponent } from '../message-dropdown/message-dropdown.component';
import { getRolesFromToken } from '../../services/jwt.util';

@Component({
  selector: 'app-navbar',
  imports: [NgIf, NgClass, RouterModule, TranslatePipe, NotificationDropdownComponent, MessageDropdownComponent],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent implements OnInit, AfterViewInit, OnDestroy {
  username: string | null = null;
  isDropdownOpen = false;
  profileImageUrl: string | null = null;
  isAdmin = false;
  private currentUserSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private elementRef: ElementRef<HTMLElement>,
  ) {}

  ngOnInit(): void {
    this.currentUserSubscription = this.authService.currentUser.subscribe((user) => {
      this.username = user ? user.username : null;
      this.isAdmin = !!user?.token && getRolesFromToken(user.token).includes('Admin');

      if (user) {
        this.getUserProfileImage();
      } else {
        this.profileImageUrl = null;
      }
    });
  }

  ngAfterViewInit(): void {
    const navbarCollapse = document.getElementById('navbarColor01');
    if (navbarCollapse) {
      navbarCollapse.addEventListener('hidden.bs.collapse', () => {
        this.isDropdownOpen = false;
      });
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['']);
  }

  ngOnDestroy(): void {
    this.currentUserSubscription?.unsubscribe();
  }

  toggleDropdown() {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: Event): void {
    const target = event.target as Node | null;

    if (!target || this.elementRef.nativeElement.contains(target)) {
      return;
    }

    this.closeMobileNavbarCollapse();
    this.isDropdownOpen = false;
  }

  closeProfileDropdown(): void {
    const dropdownToggle = document.getElementById('userDropdown');
    const dropdownContainer = dropdownToggle?.closest('.dropdown');
    const dropdownMenu = dropdownContainer?.querySelector('.dropdown-menu');

    dropdownToggle?.setAttribute('aria-expanded', 'false');
    dropdownContainer?.classList.remove('show');
    dropdownMenu?.classList.remove('show');
    dropdownMenu?.removeAttribute('data-bs-popper');
  }

  private closeMobileNavbarCollapse(): void {
    const navbarCollapse = document.getElementById('navbarColor01');
    const navbarToggler = this.elementRef.nativeElement.querySelector('.navbar-toggler');

    if (!navbarCollapse?.classList.contains('show')) {
      return;
    }

    navbarCollapse.classList.remove('show');
    navbarToggler?.setAttribute('aria-expanded', 'false');
  }

  getUserProfileImage() {
    this.userService.getMyProfile().subscribe({
      next: (user) => {
        if (user.profilePictureUrl && user.profilePictureUrl !== 'default-profile.png') {
          this.profileImageUrl = user.profilePictureUrl;
        } else {
          this.profileImageUrl = null;
        }
      },
      error: (err) => {
        this.profileImageUrl = null;
      },
    });
  }
}
