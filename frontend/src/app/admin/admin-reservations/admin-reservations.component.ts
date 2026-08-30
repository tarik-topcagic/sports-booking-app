import { Component, ViewChild } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminSelectComponent, AdminSelectOption } from '../../admin-select/admin-select.component';
import { Reservation, ReservationStatus } from '../../interfaces/reservation.model';
import { AdminReservationService } from '../../../services/admin/admin-reservation.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { SkeletonTableRowComponent } from '../../skeleton/skeleton-table-row/skeleton-table-row.component';
import { LoadErrorStateComponent } from '../../load-error-state/load-error-state.component';
import { PaginationComponent } from '../../pagination/pagination.component';

@Component({
  selector: 'app-admin-reservations',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, DatePipe, AdminSelectComponent, SkeletonTableRowComponent, LoadErrorStateComponent, PaginationComponent],
  templateUrl: './admin-reservations.component.html',
  styleUrl: './admin-reservations.component.scss',
})
export class AdminReservationsComponent {
  @ViewChild('reservationsState') reservationsState!: LoadErrorStateComponent;

  reservations: Reservation[] = [];
  pagedReservations: Reservation[] = [];
  isLoading = false;
  pendingReservationIds = new Set<number>();

  filterArenaId: number | null = null;
  filterUsername = '';
  filterStatus: ReservationStatus | '' = '';

  readonly statusOptions: AdminSelectOption[] = [
    { value: '', label: 'All' },
    { value: 'Confirmed', label: 'Confirmed' },
    { value: 'Cancelled', label: 'Cancelled' },
  ];

  hasAppliedFilters = false;

  get hasActiveFilterInputs(): boolean {
    return this.filterArenaId != null || !!this.filterUsername || !!this.filterStatus;
  }

  itemsPerPage = 10;
  resetPageSignal = 0;

  constructor(
    private adminReservationService: AdminReservationService,
    private toastService: ToastService,
    private confirmDialogService: ConfirmDialogService,
  ) {}

  loadReservations = () => {
    this.isLoading = true;
    this.hasAppliedFilters = this.hasActiveFilterInputs;

    return this.adminReservationService.getAllReservations({
      arenaId: this.filterArenaId ?? undefined,
      username: this.filterUsername || undefined,
      status: this.filterStatus || undefined,
    }).pipe(
      tap((reservations) => {
        this.reservations = reservations;
        this.isLoading = false;
        this.resetPageSignal++;
      }),
      catchError((error) => {
        console.error('Error loading reservations:', error);
        this.isLoading = false;
        return throwError(() => error);
      }),
    );
  }

  onPagedReservationsChange(pagedReservations: Reservation[]): void {
    this.pagedReservations = pagedReservations;
  }

  applyFilters(): void {
    this.reservationsState.reload();
  }

  clearFilters(): void {
    this.filterArenaId = null;
    this.filterUsername = '';
    this.filterStatus = '';
    this.reservationsState.reload();
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
        this.reservationsState.reload();
      },
      error: (error) => {
        console.error('Error cancelling reservation:', error);
        this.pendingReservationIds.delete(reservation.id);
        this.toastService.showError('Failed to cancel reservation.');
      },
    });
  }
}
