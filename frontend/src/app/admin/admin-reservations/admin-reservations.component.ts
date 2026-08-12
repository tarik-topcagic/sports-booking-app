import { Component, OnInit } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../navbar/navbar.component';
import { AdminSelectComponent, AdminSelectOption } from '../../admin-select/admin-select.component';
import { Reservation, ReservationStatus } from '../../interfaces/reservation.model';
import { AdminReservationService } from '../../../services/admin/admin-reservation.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { paginate } from '../../helpers/pagination.helper';
import { SkeletonTableRowComponent } from '../../skeleton/skeleton-table-row/skeleton-table-row.component';
import { LoadErrorStateComponent } from '../../load-error-state/load-error-state.component';
import { PaginationComponent } from '../../pagination/pagination.component';

@Component({
  selector: 'app-admin-reservations',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, DatePipe, NavbarComponent, AdminSelectComponent, SkeletonTableRowComponent, LoadErrorStateComponent, PaginationComponent],
  templateUrl: './admin-reservations.component.html',
  styleUrl: './admin-reservations.component.scss',
})
export class AdminReservationsComponent implements OnInit {
  reservations: Reservation[] = [];
  pagedReservations: Reservation[] = [];
  isLoading = false;
  errorMessage = '';
  pendingReservationIds = new Set<number>();

  filterArenaId: number | null = null;
  filterUsername = '';
  filterStatus: ReservationStatus | '' = '';

  readonly statusOptions: AdminSelectOption[] = [
    { value: '', label: 'All' },
    { value: 'Confirmed', label: 'Confirmed' },
    { value: 'Cancelled', label: 'Cancelled' },
  ];

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  totalPagesArray: number[] = [];

  constructor(
    private adminReservationService: AdminReservationService,
    private toastService: ToastService,
    private confirmDialogService: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.loadReservations();
  }

  loadReservations(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.adminReservationService.getAllReservations({
      arenaId: this.filterArenaId ?? undefined,
      username: this.filterUsername || undefined,
      status: this.filterStatus || undefined,
    }).subscribe({
      next: (reservations) => {
        this.reservations = reservations;
        this.isLoading = false;
        this.currentPage = 1;
        this.setupPagination();
      },
      error: (error) => {
        console.error('Error loading reservations:', error);
        this.errorMessage = 'Failed to load reservations.';
        this.isLoading = false;
      },
    });
  }

  private setupPagination(): void {
    const pagination = paginate(this.reservations, this.currentPage, this.itemsPerPage);
    this.pagedReservations = pagination.pagedItems;
    this.totalPages = pagination.totalPages;
    this.totalPagesArray = pagination.totalPagesArray;
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.setupPagination();
  }

  applyFilters(): void {
    this.loadReservations();
  }

  clearFilters(): void {
    this.filterArenaId = null;
    this.filterUsername = '';
    this.filterStatus = '';
    this.loadReservations();
  }

  isPending(reservation: Reservation): boolean {
    return this.pendingReservationIds.has(reservation.id);
  }

  canCancel(reservation: Reservation): boolean {
    return reservation.status === 'Confirmed';
  }

  async cancelReservation(reservation: Reservation): Promise<void> {
    if (!(await this.confirmDialogService.confirm('confirmCancelReservation'))) {
      return;
    }

    this.pendingReservationIds.add(reservation.id);
    this.adminReservationService.cancelReservation(reservation.id).subscribe({
      next: () => {
        this.pendingReservationIds.delete(reservation.id);
        this.toastService.showSuccess('Reservation cancelled.');
        this.loadReservations();
      },
      error: (error) => {
        console.error('Error cancelling reservation:', error);
        this.pendingReservationIds.delete(reservation.id);
        this.toastService.showError('Failed to cancel reservation.');
      },
    });
  }
}
