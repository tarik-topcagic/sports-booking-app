import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { DropdownCoordinatorService } from '../../services/dropdown-coordinator.service';
import { GroupService } from '../../services/group.service';
import { LanguageService } from '../../services/language.service';
import { NotificationService } from '../../services/notification.service';
import { SystemNotificationRealtimeService } from '../../services/system-notification-realtime.service';
import { ToastService } from '../../services/toast.service';
import {
  clearDropdownTimer,
  createHighlightedSet,
  incrementIf,
  isDropdownActiveForViewport,
  prependIfNotExists,
  startDropdownTimer,
} from '../helpers/dropdown-ui.helper';
import {
  respondToGroupInvitation,
  respondToGroupJoinRequest,
} from '../helpers/group-membership-actions.helper';
import { MembershipStatus } from '../interfaces/group.model';
import { AppNotification, AppNotificationType } from '../interfaces/notification.model';
import { TranslatePipe } from '../pipes/translate.pipe';
import { RelativeTimePipe } from '../pipes/relative-time.pipe';
import { SkeletonListItemComponent } from '../skeleton/skeleton-list-item/skeleton-list-item.component';

@Component({
  selector: 'app-notification-dropdown',
  imports: [NgIf, NgFor, NgClass, RouterModule, TranslatePipe, RelativeTimePipe, SkeletonListItemComponent],
  templateUrl: './notification-dropdown.component.html',
  styleUrl: './notification-dropdown.component.scss',
})
export class NotificationDropdownComponent implements OnInit, OnDestroy {
  @Input() mode: 'desktop' | 'mobile' = 'desktop';
  @Output() opened = new EventEmitter<void>();

  username: string | null = null;
  isNotificationsOpen = false;
  isLoading = false;
  notifications: AppNotification[] = [];
  unreadNotificationsCount = 0;
  highlightedNotificationIds = new Set<number>();
  respondingInvitationAction = new Map<number, boolean>();
  respondingJoinRequestAction = new Map<number, boolean>();
  notificationType = AppNotificationType;
  membershipStatus = MembershipStatus;

  private currentUserSubscription?: Subscription;
  private unreadCountSubscription?: Subscription;
  private realtimeNotificationSubscription?: Subscription;
  private coordinatorSubscription?: Subscription;
  private readonly notificationRefreshIntervalMs = 30000;
  private notificationRefreshIntervalId?: ReturnType<typeof setInterval>;
  private processedMembershipNotificationIds = new Set<number>();
  private readonly desktopMediaQuery = window.matchMedia('(min-width: 992px)');
  private readonly onViewportChange = () => this.syncViewportActivity();
  private isActiveForViewport = false;

  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private groupService: GroupService,
    private languageService: LanguageService,
    private systemNotificationRealtimeService: SystemNotificationRealtimeService,
    private toastService: ToastService,
    private router: Router,
    private elementRef: ElementRef<HTMLElement>,
    private dropdownCoordinator: DropdownCoordinatorService,
  ) {
    this.coordinatorSubscription = this.dropdownCoordinator.activeChanged$.subscribe((activeId) => {
      if (activeId !== this && this.isNotificationsOpen) {
        this.closeNotifications();
      }
    });
  }

  ngOnInit(): void {
    this.currentUserSubscription = this.authService.currentUser.subscribe((user) => {
      this.username = user ? user.username : null;

      if (this.username && this.isActiveForViewport) {
        this.loadNotifications();
        this.loadUnreadNotificationsCount();
        return;
      }

      if (!this.username) {
        this.resetNotificationsState();
      }
    });

    this.realtimeNotificationSubscription = this.systemNotificationRealtimeService.incomingSystemNotifications$.subscribe((notification) => {
      if (this.username && this.isActiveForViewport) {
        this.applyRealtimeNotification(notification);
      }
    });

    this.unreadCountSubscription = this.notificationService.unreadCountRefresh$.subscribe(() => {
      if (this.username && this.isActiveForViewport) {
        this.loadUnreadNotificationsCount();
      }
    });

    this.desktopMediaQuery.addEventListener('change', this.onViewportChange);
    this.syncViewportActivity();
  }

  ngOnDestroy(): void {
    this.currentUserSubscription?.unsubscribe();
    this.unreadCountSubscription?.unsubscribe();
    this.realtimeNotificationSubscription?.unsubscribe();
    this.coordinatorSubscription?.unsubscribe();
    this.dropdownCoordinator.close(this);
    this.desktopMediaQuery.removeEventListener('change', this.onViewportChange);
    this.stopTimers();
    void this.systemNotificationRealtimeService.disconnect();
  }

  toggleNotifications(): void {
    if (this.mode !== 'desktop') {
      return;
    }

    if (this.isNotificationsOpen) {
      this.closeNotifications();
      return;
    }

    this.dropdownCoordinator.open(this, this.elementRef.nativeElement);
    this.isNotificationsOpen = true;
    this.opened.emit();
    this.loadNotifications(true);
  }

  openNotification(notification: AppNotification): void {
    if (notification.groupId) {
      this.router.navigate(['/groups', notification.groupId]);
      this.closeNotifications();
    } else if (notification.reservationId) {
      this.router.navigate(['/my-reservations']);
      this.closeNotifications();
    }
  }

  acceptInvitation(notification: AppNotification, event: Event): void {
    event.stopPropagation();
    this.respondToInvitation(notification, true);
  }

  declineInvitation(notification: AppNotification, event: Event): void {
    event.stopPropagation();
    this.respondToInvitation(notification, false);
  }

  acceptJoinRequest(notification: AppNotification, event: Event): void {
    event.stopPropagation();
    this.respondToJoinRequest(notification, true);
  }

  declineJoinRequest(notification: AppNotification, event: Event): void {
    event.stopPropagation();
    this.respondToJoinRequest(notification, false);
  }

  getNotificationText(notification: AppNotification): string {
    const groupName = this.formatNotificationGroupName(notification.groupName);

    if (notification.type === AppNotificationType.ReservationReminder1Hour) {
      return this.interpolate('reservationReminder1HourNotification', {
        arenaName: notification.arenaName || '',
      });
    }

    if (notification.type === AppNotificationType.ReservationReminder30Minutes) {
      return this.interpolate('reservationReminder30MinutesNotification', {
        arenaName: notification.arenaName || '',
      });
    }

    if (notification.type === AppNotificationType.GroupInvitationReceived) {
      return this.interpolate('invitationReceivedNotification', { groupName });
    }

    if (notification.type === AppNotificationType.GroupJoinRequestReceived) {
      return this.interpolate('joinRequestReceivedNotification', {
        userName: notification.actorName || '',
        groupName,
      });
    }

    if (notification.type === AppNotificationType.GroupJoinRequestAccepted) {
      return this.interpolate('joinRequestAcceptedNotification', { groupName });
    }

    return this.interpolate('invitationAcceptedNotification', {
      userName: notification.actorName || '',
      groupName,
    });
  }

  canRespondToInvitation(notification: AppNotification): boolean {
    return notification.type === AppNotificationType.GroupInvitationReceived
      && !!notification.membershipId
      && notification.invitationStatus === MembershipStatus.PendingInvitation;
  }

  canRespondToJoinRequest(notification: AppNotification): boolean {
    return notification.type === AppNotificationType.GroupJoinRequestReceived
      && !!notification.groupId
      && !!notification.membershipId
      && notification.membershipStatus === MembershipStatus.PendingJoinRequest;
  }

  isResponding(notification: AppNotification): boolean {
    return !!notification.membershipId
      && (this.respondingInvitationAction.has(notification.membershipId)
        || this.respondingJoinRequestAction.has(notification.membershipId));
  }

  isRespondingInvitation(notification: AppNotification, accept: boolean): boolean {
    return !!notification.membershipId
      && this.respondingInvitationAction.get(notification.membershipId) === accept;
  }

  isRespondingJoinRequest(notification: AppNotification, accept: boolean): boolean {
    return !!notification.membershipId
      && this.respondingJoinRequestAction.get(notification.membershipId) === accept;
  }

  isHighlightedNotification(notification: AppNotification): boolean {
    return this.highlightedNotificationIds.has(notification.id);
  }

  private syncViewportActivity(): void {
    const shouldBeActive = isDropdownActiveForViewport(this.mode, this.desktopMediaQuery);

    if (shouldBeActive === this.isActiveForViewport) {
      return;
    }

    this.isActiveForViewport = shouldBeActive;

    if (shouldBeActive) {
      void this.systemNotificationRealtimeService.connect();
      this.startTimers();

      if (this.username) {
        this.loadNotifications();
        this.loadUnreadNotificationsCount();
      }

      return;
    }

    this.stopTimers();
    void this.systemNotificationRealtimeService.disconnect();
    this.closeNotifications();
  }

  private startTimers(): void {
    this.stopTimers();

    this.notificationRefreshIntervalId = startDropdownTimer(() => {
      if (!this.username) {
        return;
      }

      this.loadUnreadNotificationsCount();
      this.loadNotifications();
    }, this.notificationRefreshIntervalMs);
  }

  private stopTimers(): void {
    this.notificationRefreshIntervalId = clearDropdownTimer(this.notificationRefreshIntervalId);
  }

  private closeNotifications(): void {
    this.isNotificationsOpen = false;
    this.highlightedNotificationIds.clear();
    this.dropdownCoordinator.close(this);
  }

  private loadNotifications(captureUnreadHighlights = false): void {
    if (!this.username || !this.isActiveForViewport) {
      return;
    }

    if (!this.notifications.length) {
      this.isLoading = true;
    }

    this.notificationService.getNotifications().subscribe({
      next: (notifications) => {
        this.isLoading = false;

        if (captureUnreadHighlights) {
          this.highlightedNotificationIds = createHighlightedSet(
            notifications,
            (notification) => !notification.isRead,
            (notification) => notification.id,
          );
        }

        this.notifications = notifications;
        this.publishMembershipChangesFromNotifications(notifications);

        if (captureUnreadHighlights) {
          this.markNotificationsAsRead();
        }
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error loading notifications:', error);
      },
    });
  }

  private loadUnreadNotificationsCount(): void {
    if (!this.username || !this.isActiveForViewport) {
      return;
    }

    this.notificationService.getUnreadCount().subscribe({
      next: (response) => {
        this.unreadNotificationsCount = response.count;
      },
      error: (error) => {
        console.error('Error loading notification count:', error);
      },
    });
  }

  private markNotificationsAsRead(): void {
    if (!this.unreadNotificationsCount) {
      return;
    }

    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.unreadNotificationsCount = 0;
        this.notificationService.notifyUnreadCountChanged();
        this.notifications = this.notifications.map((notification) => ({
          ...notification,
          isRead: true,
        }));
      },
      error: (error) => {
        console.error('Error marking notifications as read:', error);
      },
    });
  }

  private respondToInvitation(notification: AppNotification, accept: boolean): void {
    if (!notification.membershipId || this.isResponding(notification)) {
      return;
    }

    this.respondingInvitationAction.set(notification.membershipId, accept);

    respondToGroupInvitation(
      this.groupService,
      notification.membershipId,
      accept,
      notification.groupId ?? undefined,
      {
        onSuccess: () => {
        this.respondingInvitationAction.delete(notification.membershipId!);
        notification.invitationStatus = accept ? MembershipStatus.Accepted : MembershipStatus.Declined;
        notification.isRead = true;
        this.loadNotifications();
        this.loadUnreadNotificationsCount();
      },
        onError: (error) => {
        this.respondingInvitationAction.delete(notification.membershipId!);
        this.toastService.showError(this.languageService.translate('invitationResponseError'));
        console.error('Error responding to invitation:', error);
      },
      },
    );
  }

  private respondToJoinRequest(notification: AppNotification, accept: boolean): void {
    if (!notification.groupId || !notification.membershipId || this.isResponding(notification)) {
      return;
    }

    this.respondingJoinRequestAction.set(notification.membershipId, accept);

    respondToGroupJoinRequest(
      this.groupService,
      notification.groupId,
      notification.membershipId,
      accept,
      {
        onSuccess: () => {
        this.respondingJoinRequestAction.delete(notification.membershipId!);
        notification.membershipStatus = accept ? MembershipStatus.Accepted : MembershipStatus.Declined;
        notification.isRead = true;
        this.loadNotifications();
        this.loadUnreadNotificationsCount();
      },
        onError: (error) => {
        this.respondingJoinRequestAction.delete(notification.membershipId!);
        this.toastService.showError(this.languageService.translate('joinRequestResponseError'));
        console.error('Error responding to join request:', error);
      },
      },
    );
  }

  private interpolate(key: string, values: Record<string, string>): string {
    return Object.entries(values).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, value),
      this.languageService.translate(key),
    );
  }

  private formatNotificationGroupName(groupName?: string | null): string {
    return groupName ? `"${groupName}"` : '';
  }

  private publishMembershipChangesFromNotifications(notifications: AppNotification[]): void {
    for (const notification of notifications) {
      if (notification.type !== AppNotificationType.GroupJoinRequestAccepted
        || this.processedMembershipNotificationIds.has(notification.id)) {
        continue;
      }

      this.processedMembershipNotificationIds.add(notification.id);
      this.groupService.notifyMembershipChanged();
    }
  }

  private resetNotificationsState(): void {
    this.notifications = [];
    this.unreadNotificationsCount = 0;
    this.isLoading = false;
    this.highlightedNotificationIds.clear();
    this.respondingInvitationAction.clear();
    this.respondingJoinRequestAction.clear();
    this.closeNotifications();
  }

  private applyRealtimeNotification(notification: AppNotification): void {
    const nextNotifications = prependIfNotExists(
      this.notifications,
      notification,
      (existingNotification) => existingNotification.id === notification.id,
    );

    if (nextNotifications === this.notifications) {
      return;
    }

    this.notifications = nextNotifications;
    this.unreadNotificationsCount = incrementIf(this.unreadNotificationsCount, !notification.isRead);

    if (!notification.isRead) {
      this.highlightedNotificationIds.add(notification.id);
    }

    this.publishMembershipChangesFromNotifications([notification]);
  }
}
