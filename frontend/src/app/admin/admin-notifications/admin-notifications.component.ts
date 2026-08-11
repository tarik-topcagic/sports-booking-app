import { Component, OnInit } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../navbar/navbar.component';
import { AdminSelectComponent, AdminSelectOption } from '../../admin-select/admin-select.component';
import { AppNotification } from '../../interfaces/notification.model';
import { AdminNotificationService } from '../../../services/admin/admin-notification.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { paginate } from '../../helpers/pagination.helper';
import { SkeletonTableRowComponent } from '../../skeleton/skeleton-table-row/skeleton-table-row.component';
import { LoadErrorStateComponent } from '../../load-error-state/load-error-state.component';

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
  imports: [NgFor, NgIf, FormsModule, DatePipe, NavbarComponent, AdminSelectComponent, SkeletonTableRowComponent, LoadErrorStateComponent],
  templateUrl: './admin-notifications.component.html',
  styleUrl: './admin-notifications.component.scss',
})
export class AdminNotificationsComponent implements OnInit {
  notifications: AppNotification[] = [];
  pagedNotifications: AppNotification[] = [];
  isLoading = false;
  errorMessage = '';
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

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  totalPagesArray: number[] = [];

  constructor(
    private adminNotificationService: AdminNotificationService,
    private toastService: ToastService,
    private confirmDialogService: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.adminNotificationService.getAllNotifications({
      type: this.filterType || undefined,
      isRead: this.filterIsRead ? this.filterIsRead === 'true' : undefined,
      username: this.filterUsername || undefined,
    }).subscribe({
      next: (notifications) => {
        this.notifications = notifications;
        this.isLoading = false;
        this.currentPage = 1;
        this.setupPagination();
      },
      error: (error) => {
        console.error('Error loading notifications:', error);
        this.errorMessage = 'Failed to load notifications.';
        this.isLoading = false;
      },
    });
  }

  applyFilters(): void {
    this.loadNotifications();
  }

  clearFilters(): void {
    this.filterType = '';
    this.filterIsRead = '';
    this.filterUsername = '';
    this.loadNotifications();
  }

  private setupPagination(): void {
    const pagination = paginate(this.notifications, this.currentPage, this.itemsPerPage);
    this.pagedNotifications = pagination.pagedItems;
    this.totalPages = pagination.totalPages;
    this.totalPagesArray = pagination.totalPagesArray;
  }

  previousPage(event: Event): void {
    event.preventDefault();
    if (this.currentPage > 1) {
      this.currentPage--;
      this.setupPagination();
    }
  }

  nextPage(event: Event): void {
    event.preventDefault();
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
      this.setupPagination();
    }
  }

  goToPage(page: number, event: Event): void {
    event.preventDefault();
    this.currentPage = page;
    this.setupPagination();
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
        this.notifications = this.notifications.filter((n) => n.id !== notification.id);
        this.setupPagination();
      },
      error: (error) => {
        console.error('Error deleting notification:', error);
        this.pendingNotificationIds.delete(notification.id);
        this.toastService.showError('Failed to delete notification.');
      },
    });
  }
}
