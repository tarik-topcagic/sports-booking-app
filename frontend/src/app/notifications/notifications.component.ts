import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, Subscription, tap, throwError } from 'rxjs';
import { GroupService } from '../../services/group.service';
import { LanguageService } from '../../services/language.service';
import { NotificationService } from '../../services/notification.service';
import { SystemNotificationRealtimeService } from '../../services/system-notification-realtime.service';
import { AppNotification, AppNotificationType } from '../interfaces/notification.model';
import { MembershipStatus } from '../interfaces/group.model';
import { TranslatePipe } from '../pipes/translate.pipe';
import { RelativeTimePipe } from '../pipes/relative-time.pipe';
import { SkeletonListItemComponent } from '../skeleton/skeleton-list-item/skeleton-list-item.component';
import { ToastService } from '../../services/toast.service';
import { createHighlightedSet, prependIfNotExists } from '../helpers/dropdown-ui.helper';
import {
  respondToGroupInvitation,
  respondToGroupJoinRequest,
} from '../helpers/group-membership-actions.helper';
import { LoadErrorStateComponent } from '../load-error-state/load-error-state.component';

@Component({
  selector: 'app-notifications',
  imports: [NgClass, NgFor, NgIf, TranslatePipe, RelativeTimePipe, SkeletonListItemComponent, LoadErrorStateComponent],
  templateUrl: './notifications.component.html',
  styleUrl: './notifications.component.scss',
})
export class NotificationsComponent implements OnInit, OnDestroy {
  @ViewChild('notificationsState') notificationsState!: LoadErrorStateComponent;

  notifications: AppNotification[] = [];
  highlightedNotificationIds = new Set<number>();
  respondingInvitationAction = new Map<number, boolean>();
  respondingJoinRequestAction = new Map<number, boolean>();
  notificationType = AppNotificationType;
  membershipStatus = MembershipStatus;
  private readonly notificationRefreshIntervalMs = 30000;
  private notificationRefreshIntervalId?: ReturnType<typeof setInterval>;
  private processedMembershipNotificationIds = new Set<number>();
  private realtimeNotificationSubscription?: Subscription;

  constructor(
    private notificationService: NotificationService,
    private groupService: GroupService,
    private languageService: LanguageService,
    private systemNotificationRealtimeService: SystemNotificationRealtimeService,
    private toastService: ToastService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    void this.systemNotificationRealtimeService.connect();

    this.realtimeNotificationSubscription = this.systemNotificationRealtimeService.incomingSystemNotifications$.subscribe((notification) => {
      this.applyRealtimeNotification(notification);
    });

    this.notificationRefreshIntervalId = setInterval(() => {
      this.silentRefreshNotifications();
    }, this.notificationRefreshIntervalMs);
  }

  ngOnDestroy(): void {
    this.realtimeNotificationSubscription?.unsubscribe();

    if (this.notificationRefreshIntervalId) {
      clearInterval(this.notificationRefreshIntervalId);
    }

    void this.systemNotificationRealtimeService.disconnect();
  }

  openNotification(notification: AppNotification): void {
    if (notification.groupId) {
      this.notificationService.markAsRead(notification.id).subscribe({
        next: () => {
          notification.isRead = true;
          this.router.navigate(['/groups', notification.groupId]);
        },
        error: () => this.router.navigate(['/groups', notification.groupId]),
      });
    } else if (notification.reservationId) {
      this.notificationService.markAsRead(notification.id).subscribe({
        next: () => {
          notification.isRead = true;
          this.router.navigate(['/my-reservations']);
        },
        error: () => this.router.navigate(['/my-reservations']),
      });
    }
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

  isHighlightedNotification(notification: AppNotification): boolean {
    return this.highlightedNotificationIds.has(notification.id);
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

  loadNotifications = () => this.notificationService.getNotifications().pipe(
    tap((notifications) => this.applyLoadedNotifications(notifications, true)),
    catchError((error) => {
      console.error('Error loading notifications:', error);
      return throwError(() => error);
    }),
  );

  private silentRefreshNotifications(): void {
    this.notificationService.getNotifications().subscribe({
      next: (notifications) => this.applyLoadedNotifications(notifications, false),
      error: (error) => console.error('Error loading notifications:', error),
    });
  }

  private applyLoadedNotifications(notifications: AppNotification[], computeHighlights: boolean): void {
    if (computeHighlights) {
      this.highlightedNotificationIds = createHighlightedSet(
        notifications,
        (notification) => !notification.isRead,
        (notification) => notification.id,
      );
    }

    this.notifications = notifications;
    this.publishMembershipChangesFromNotifications(notifications);
    this.markNotificationsAsRead();
  }

  private markNotificationsAsRead(): void {
    if (!this.notifications.some((notification) => !notification.isRead)) {
      return;
    }

    this.notificationService.markAllAsRead().subscribe({
      next: () => {
        this.notifications = this.notifications.map((notification) => ({
          ...notification,
          isRead: true,
        }));
        this.notificationService.notifyUnreadCountChanged();
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
        this.notificationsState.reload();
        this.notificationService.notifyUnreadCountChanged();
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
        this.notificationsState.reload();
        this.notificationService.notifyUnreadCountChanged();
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
    this.highlightedNotificationIds.add(notification.id);
    this.publishMembershipChangesFromNotifications([notification]);
    this.notificationService.notifyUnreadCountChanged();
  }
}
