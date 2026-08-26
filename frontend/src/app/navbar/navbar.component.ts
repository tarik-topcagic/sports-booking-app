import { Component, OnInit, AfterViewInit, OnDestroy, ElementRef, HostListener, ViewChild } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { NgClass, NgIf } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { UserService } from '../../services/user.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { Subscription } from 'rxjs';
import { NotificationDropdownComponent } from '../notification-dropdown/notification-dropdown.component';
import { MessageDropdownComponent } from '../message-dropdown/message-dropdown.component';
import { DropdownCoordinatorService } from '../../services/dropdown-coordinator.service';
import { getRolesFromToken } from '../../services/jwt.util';

@Component({
  selector: 'app-navbar',
  imports: [NgIf, NgClass, RouterModule, TranslatePipe, NotificationDropdownComponent, MessageDropdownComponent],
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
})
export class NavbarComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mobileProfileMenuWrapper') mobileProfileMenuWrapperRef!: ElementRef<HTMLElement>;

  username: string | null = null;
  isDropdownOpen = false;
  profileImageUrl: string | null = null;
  isAdmin = false;
  private currentUserSubscription?: Subscription;
  private coordinatorSubscription?: Subscription;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private router: Router,
    private elementRef: ElementRef<HTMLElement>,
    private dropdownCoordinator: DropdownCoordinatorService,
  ) {
    this.coordinatorSubscription = this.dropdownCoordinator.activeChanged$.subscribe((activeId) => {
      if (activeId !== this && this.isDropdownOpen) {
        this.isDropdownOpen = false;
      }
    });
  }

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
        this.dropdownCoordinator.close(this);
      });
    }
  }

  logout() {
    this.router.navigate(['']).then((navigated) => {
      if (navigated) {
        this.authService.logout();
      }
    });
  }

  ngOnDestroy(): void {
    this.currentUserSubscription?.unsubscribe();
    this.coordinatorSubscription?.unsubscribe();
    this.dropdownCoordinator.close(this);
  }

  toggleDropdown() {
    if (this.isDropdownOpen) {
      this.isDropdownOpen = false;
      this.dropdownCoordinator.close(this);
      return;
    }

    this.dropdownCoordinator.open(this, this.mobileProfileMenuWrapperRef.nativeElement);
    this.isDropdownOpen = true;
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: Event): void {
    const target = event.target as Node | null;

    if (!target || this.elementRef.nativeElement.contains(target)) {
      return;
    }

    this.closeMobileNavbarCollapse();
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

  handleImageError(): void {
    this.profileImageUrl = null;
  }
}
