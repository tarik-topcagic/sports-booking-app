import { Component, ViewChild } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSelectComponent, AdminSelectOption } from '../../admin-select/admin-select.component';
import { AppNotification } from '../../interfaces/notification.model';
import { AdminNotificationService } from '../../../services/admin/admin-notification.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { SkeletonTableRowComponent } from '../../skeleton/skeleton-table-row/skeleton-table-row.component';
import { LoadErrorStateComponent } from '../../load-error-state/load-error-state.component';
import { PaginationComponent } from '../../pagination/pagination.component';

const NOTIFICATION_TYPES = [
  'GroupInvitationReceived',
  'GroupInvitationAccepted',
  'GroupJoinRequestReceived',
  'GroupJoinRequestAccepted',
  'ReservationReminder1Hour',
  'ReservationReminder30Minutes',
];

@Component({
  selector: 'app-admin-notifications',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, DatePipe, AdminSelectComponent, SkeletonTableRowComponent, LoadErrorStateComponent, PaginationComponent],
  templateUrl: './admin-notifications.component.html',
  styleUrl: './admin-notifications.component.scss',
})
export class AdminNotificationsComponent {
  @ViewChild('notificationsState') notificationsState!: LoadErrorStateComponent;

  notifications: AppNotification[] = [];
  pagedNotifications: AppNotification[] = [];
  isLoading = false;
  pendingNotificationIds = new Set<number>();

  readonly notificationTypes = NOTIFICATION_TYPES;

  readonly typeOptions: AdminSelectOption[] = [
    { value: '', label: 'All' },
    ...NOTIFICATION_TYPES.map((type) => ({ value: type, label: type })),
  ];

  readonly isReadOptions: AdminSelectOption[] = [
    { value: '', label: 'All' },
    { value: 'true', label: 'Read' },
    { value: 'false', label: 'Unread' },
  ];

  filterType = '';
  filterIsRead: '' | 'true' | 'false' = '';
  filterUsername = '';

  itemsPerPage = 10;
  resetPageSignal = 0;

  constructor(
    private adminNotificationService: AdminNotificationService,
    private toastService: ToastService,
    private confirmDialogService: ConfirmDialogService,
  ) {}

  loadNotifications = () => {
    this.isLoading = true;

    return this.adminNotificationService.getAllNotifications({
      type: this.filterType || undefined,
      isRead: this.filterIsRead ? this.filterIsRead === 'true' : undefined,
      username: this.filterUsername || undefined,
    }).pipe(
      tap((notifications) => {
        this.notifications = notifications;
        this.isLoading = false;
        this.resetPageSignal++;
      }),
      catchError((error) => {
        console.error('Error loading notifications:', error);
        this.isLoading = false;
        return throwError(() => error);
      }),
    );
  }

  applyFilters(): void {
    this.notificationsState.reload();
  }

  clearFilters(): void {
    this.filterType = '';
    this.filterIsRead = '';
    this.filterUsername = '';
    this.notificationsState.reload();
  }

  onPagedNotificationsChange(pagedNotifications: AppNotification[]): void {
    this.pagedNotifications = pagedNotifications;
  }

  isPending(notification: AppNotification): boolean {
    return this.pendingNotificationIds.has(notification.id);
  }

  async deleteNotification(notification: AppNotification): Promise<void> {
    if (!(await this.confirmDialogService.confirm('confirmDeleteNotification'))) {
      return;
    }

    this.pendingNotificationIds.add(notification.id);
    this.adminNotificationService.deleteNotification(notification.id).subscribe({
      next: () => {
        this.pendingNotificationIds.delete(notification.id);
        this.toastService.showSuccess('Notification deleted.');
        this.notificationsState.reload();
      },
      error: (error) => {
        console.error('Error deleting notification:', error);
        this.pendingNotificationIds.delete(notification.id);
        this.toastService.showError('Failed to delete notification.');
      },
    });
  }
}
