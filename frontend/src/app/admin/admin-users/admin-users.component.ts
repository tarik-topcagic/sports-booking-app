import { Component, OnInit } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../navbar/navbar.component';
import { AdminSelectComponent, AdminSelectOption } from '../../admin-select/admin-select.component';
import { AdminUserDto } from '../../interfaces/admin/admin-user.model';
import { AdminUserService } from '../../../services/admin/admin-user.service';
import { ToastService } from '../../../services/toast.service';
import { AuthService } from '../../../services/auth.service';
import { getUserIdFromToken } from '../../../services/jwt.util';
import { paginate } from '../../helpers/pagination.helper';
import { SkeletonTableRowComponent } from '../../skeleton/skeleton-table-row/skeleton-table-row.component';
import { LoadErrorStateComponent } from '../../load-error-state/load-error-state.component';
import { PaginationComponent } from '../../pagination/pagination.component';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, DatePipe, NavbarComponent, AdminSelectComponent, SkeletonTableRowComponent, LoadErrorStateComponent, PaginationComponent],
  templateUrl: './admin-users.component.html',
  styleUrl: './admin-users.component.scss',
})
export class AdminUsersComponent implements OnInit {
  users: AdminUserDto[] = [];
  pagedUsers: AdminUserDto[] = [];
  isLoading = false;
  errorMessage = '';
  pendingUserIds = new Set<string>();
  currentUserId: string | null = null;

  filterUsername = '';
  filterRole: '' | 'Admin' | 'Non-admin' = '';
  filterLocked: '' | 'true' | 'false' = '';

  readonly roleOptions: AdminSelectOption[] = [
    { value: '', label: 'All' },
    { value: 'Admin', label: 'Admin' },
    { value: 'Non-admin', label: 'Non-admin' },
  ];

  readonly lockedOptions: AdminSelectOption[] = [
    { value: '', label: 'All' },
    { value: 'false', label: 'Active' },
    { value: 'true', label: 'Locked' },
  ];

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  totalPagesArray: number[] = [];

  constructor(
    private adminUserService: AdminUserService,
    private toastService: ToastService,
    private authService: AuthService,
  ) {}

  ngOnInit(): void {
    const token = this.authService.currentUserValue?.token;
    this.currentUserId = token ? getUserIdFromToken(token) : null;
    this.loadUsers();
  }

  isSelf(user: AdminUserDto): boolean {
    return !!this.currentUserId && user.id === this.currentUserId;
  }

  loadUsers(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.adminUserService.getAllUsers({
      username: this.filterUsername || undefined,
      role: this.filterRole || undefined,
      locked: this.filterLocked ? this.filterLocked === 'true' : undefined,
    }).subscribe({
      next: (users) => {
        this.users = users;
        this.isLoading = false;
        this.currentPage = 1;
        this.setupPagination();
      },
      error: (error) => {
        console.error('Error loading users:', error);
        this.errorMessage = 'Failed to load users.';
        this.isLoading = false;
      },
    });
  }

  applyFilters(): void {
    this.loadUsers();
  }

  clearFilters(): void {
    this.filterUsername = '';
    this.filterRole = '';
    this.filterLocked = '';
    this.loadUsers();
  }

  private setupPagination(): void {
    const pagination = paginate(this.users, this.currentPage, this.itemsPerPage);
    this.pagedUsers = pagination.pagedItems;
    this.totalPages = pagination.totalPages;
    this.totalPagesArray = pagination.totalPagesArray;
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.setupPagination();
  }

  isLocked(user: AdminUserDto): boolean {
    if (!user.lockoutEnd) {
      return false;
    }
    return new Date(user.lockoutEnd).getTime() > Date.now();
  }

  toggleLock(user: AdminUserDto): void {
    const willLock = !this.isLocked(user);
    this.pendingUserIds.add(user.id);
    const action = willLock
      ? this.adminUserService.lockUser(user.id)
      : this.adminUserService.unlockUser(user.id);

    action.subscribe({
      next: () => {
        this.pendingUserIds.delete(user.id);
        this.toastService.showSuccess(willLock ? 'User locked.' : 'User unlocked.');
        this.loadUsers();
      },
      error: (error) => {
        console.error('Error updating user lockout state:', error);
        this.pendingUserIds.delete(user.id);
        this.toastService.showError('Failed to update user.');
      },
    });
  }

  isPending(user: AdminUserDto): boolean {
    return this.pendingUserIds.has(user.id);
  }
}
