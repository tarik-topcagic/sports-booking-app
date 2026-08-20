import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { Reservation } from '../interfaces/reservation.model';
import { getMonthAbbreviationKey, getWeekdayAbbreviationKey } from '../helpers/date-format.helper';
import { getArenaDisplayImage } from '../helpers/arena-ui.helper';
import { Arena } from '../interfaces/arena.model';
import { NavbarComponent } from '../navbar/navbar.component';
import { TranslatePipe } from '../pipes/translate.pipe';
import { SkeletonListItemComponent } from '../skeleton/skeleton-list-item/skeleton-list-item.component';
import { LoadErrorStateComponent } from '../load-error-state/load-error-state.component';
import { ReservationService } from '../../services/reservation.service';
import { LanguageService } from '../../services/language.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-my-reservations',
  imports: [NgIf, NgFor, NgClass, NavbarComponent, TranslatePipe, SkeletonListItemComponent, LoadErrorStateComponent],
  templateUrl: './my-reservations.component.html',
  styleUrl: './my-reservations.component.scss',
})
export class MyReservationsComponent {
  private readonly localeByLanguage: Record<string, string> = {
    en: 'en-US',
    de: 'de-DE',
    bs: 'bs-BA',
    hr: 'hr-HR',
    sr: 'sr-Latn-RS',
    es: 'es-ES',
    fr: 'fr-FR',
    it: 'it-IT',
  };

  @ViewChild('reservationsState') reservationsState!: LoadErrorStateComponent;

  reservations: Reservation[] = [];
  cancellingId: number | null = null;

  constructor(
    private reservationService: ReservationService,
    private languageService: LanguageService,
    private toastService: ToastService,
    private confirmDialogService: ConfirmDialogService,
  ) {}

  ngOnInit(): void {}

  get currentLocale(): string {
    return this.localeByLanguage[this.languageService.currentLanguage] || 'en-US';
  }

  get upcomingReservations(): Reservation[] {
    const now = new Date();
    return this.reservations
      .filter((r) => new Date(r.startTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  get pastReservations(): Reservation[] {
    const now = new Date();
    return this.reservations
      .filter((r) => new Date(r.startTime) <= now)
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }

  canCancel(reservation: Reservation): boolean {
    return reservation.status === 'Confirmed' && new Date(reservation.startTime) > new Date();
  }

  formatDateTime(value: string): string {
    const date = new Date(value);
    const year = new Intl.DateTimeFormat('en-US', { year: 'numeric' }).format(date);
    const time = new Intl.DateTimeFormat(this.currentLocale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);

    const month = this.languageService.translate(getMonthAbbreviationKey(date));
    const day = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(date);
    const weekday = this.languageService.translate(getWeekdayAbbreviationKey(date));
    const readableDate = `${month} ${day}, ${weekday}`;

    return `${readableDate}, ${year}, ${time}`;
  }

  formatDuration(hours: number): string {
    return `${hours}h`;
  }

  async cancelReservation(reservation: Reservation): Promise<void> {
    const confirmed = await this.confirmDialogService.confirm('confirmCancelReservation', {
      previewName: reservation.arenaName,
      previewImageUrl: getArenaDisplayImage({ id: reservation.arenaId } as Arena),
    });

    if (!confirmed) {
      return;
    }

    this.cancellingId = reservation.id;

    this.reservationService.cancelReservation(reservation.id).subscribe({
      next: () => {
        this.cancellingId = null;
        this.toastService.showSuccess(this.languageService.translate('reservationCancelledSuccess'));
        this.reservationsState.reload();
      },
      error: (error) => {
        this.cancellingId = null;
        const message = error?.error?.message || error?.error;
        this.toastService.showError(
          typeof message === 'string' ? message : this.languageService.translate('reservationCancelError'),
        );
      },
    });
  }

  loadReservations = () => this.reservationService.getMyReservations().pipe(
    tap((reservations) => {
      this.reservations = reservations;
    }),
    catchError((error) => {
      console.error('Error loading reservations:', error);
      return throwError(() => error);
    }),
  );
}
