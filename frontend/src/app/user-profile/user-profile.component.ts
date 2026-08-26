import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { UserService } from '../../services/user.service';
import { NgIf } from '@angular/common';
import { TranslatePipe } from '../pipes/translate.pipe';
import { ChooseGroupModalComponent } from '../choose-group-modal/choose-group-modal.component';
import { User } from '../interfaces/user';
import { AuthService } from '../../services/auth.service';
import { PresenceService } from '../../services/presence.service';
import { catchError, NEVER, Subscription, tap, throwError, of } from 'rxjs';
import { UserPresence } from '../interfaces/user-presence.model';
import { SkeletonComponent } from '../skeleton/skeleton/skeleton.component';
import { LoadErrorStateComponent } from '../load-error-state/load-error-state.component';

@Component({
  selector: 'app-user-profile',
  imports: [NgIf, TranslatePipe, RouterLink, ChooseGroupModalComponent, SkeletonComponent, LoadErrorStateComponent],
  templateUrl: './user-profile.component.html',
  styleUrl: './user-profile.component.scss'
})
export class UserProfileComponent implements OnInit, OnDestroy {
  @ViewChild('profileState') profileState!: LoadErrorStateComponent;

  userProfile: User | null = null;
  selectedUserForGroupInvite: User | null = null;
  timestamp: number = Date.now();
  currentUserId: string | null = null;
  canShowPresence = false;
  isProfileUserOnline = false;
  private presenceSubscription?: Subscription;
  private routeSubscription?: Subscription;
  private isInitialRouteParamsEmission = true;

  constructor(
    private route: ActivatedRoute,
    private userService: UserService,
    private authService: AuthService,
    private presenceService: PresenceService,
    private router: Router,
  ) { }

  ngOnInit(): void {
    this.currentUserId = this.authService.currentUserValue?.id || null;
    this.presenceSubscription = this.presenceService.presenceUpdates$.subscribe((update) => {
      this.handlePresenceUpdate(update);
    });

    this.routeSubscription = this.route.paramMap.subscribe(() => {
      if (this.isInitialRouteParamsEmission) {
        this.isInitialRouteParamsEmission = false;
        return;
      }

      this.profileState.reload();
    });
  }

  ngOnDestroy(): void {
    this.presenceSubscription?.unsubscribe();
    this.routeSubscription?.unsubscribe();
    void this.presenceService.disconnectRealtime();
  }

  loadUserProfile = () => {
    const username = this.route.snapshot.paramMap.get('username');
    if (!username) {
      return NEVER;
    }

    const currentUsername = this.authService.currentUserValue?.username;
    const profileRequest = currentUsername && currentUsername.toLowerCase() === username.toLowerCase()
      ? this.userService.getMyProfile()
      : this.userService.getUserProfileByUsername(username);

    return profileRequest.pipe(
      tap((user) => {
        this.userProfile = user;
        this.loadPresenceForProfileUser();
      }),
      catchError((error) => {
        this.userProfile = null;

        if (error?.status === 404 && error.error?.redirectUsername) {
          this.router.navigate(['/users', error.error.redirectUsername], { replaceUrl: true });
          return of(undefined);
        }

        console.error('User not found', error);
        return throwError(() => error);
      }),
    );
  }

  handleImageError(): void {
    if (this.userProfile) {
      this.userProfile.profilePictureUrl = 'default-profile.png';
    }
  }

  openChooseGroupModal(): void {
    if (this.userProfile?.id) {
      this.selectedUserForGroupInvite = this.userProfile;
    }
  }

  closeChooseGroupModal(): void {
    this.selectedUserForGroupInvite = null;
  }

  isOwnProfile(): boolean {
    return !!this.userProfile?.id && !!this.currentUserId && this.userProfile.id === this.currentUserId;
  }

  openPrivateChat(): void {
    if (this.isOwnProfile()) {
      return;
    }

    if (this.userProfile?.id) {
      this.router.navigate(['/messages/private/user', this.userProfile.id]);
      return;
    }

    const username = this.route.snapshot.paramMap.get('username');
    if (!username) {
      console.error('Cannot open private chat from user profile because username is missing.');
      return;
    }

    this.userService.getUserProfileByUsername(username).subscribe({
      next: (resolvedUser) => {
        if (!resolvedUser.id) {
          console.error('Cannot open private chat from user profile because resolved user id is missing.');
          return;
        }

        this.router.navigate(['/messages/private/user', resolvedUser.id]);
      },
      error: (error) => {
        console.error('Error resolving target user before opening private chat from user profile:', error);
      },
    });
  }

  private loadPresenceForProfileUser(): void {
    if (!this.userProfile?.id || this.isOwnProfile()) {
      this.canShowPresence = false;
      this.isProfileUserOnline = false;
      return;
    }

    void this.presenceService.connectRealtime();
    this.presenceService.getUserPresence(this.userProfile.id).subscribe({
      next: (presence) => {
        this.canShowPresence = true;
        this.isProfileUserOnline = presence.isOnline;
      },
      error: () => {
        this.canShowPresence = false;
        this.isProfileUserOnline = false;
      },
    });
  }

  private handlePresenceUpdate(update: UserPresence): void {
    if (!this.userProfile?.id || !this.canShowPresence || update.userId !== this.userProfile.id) {
      return;
    }

    this.isProfileUserOnline = update.isOnline;
  }
}
