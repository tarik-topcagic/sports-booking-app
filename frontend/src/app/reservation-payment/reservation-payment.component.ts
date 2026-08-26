import { NgFor, NgIf } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { Arena } from '../interfaces/arena.model';
import { getMonthAbbreviationKey, getWeekdayAbbreviationKey } from '../helpers/date-format.helper';
import { TranslatePipe } from '../pipes/translate.pipe';
import { SkeletonComponent } from '../skeleton/skeleton/skeleton.component';
import { LoadErrorStateComponent } from '../load-error-state/load-error-state.component';
import { ArenaService } from '../../services/arena.service';
import { LanguageService } from '../../services/language.service';
import { ReservationService } from '../../services/reservation.service';
import { ToastService } from '../../services/toast.service';
import { CanComponentDeactivate } from '../guards/can-component-deactivate';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

const ADDITIONAL_HALF_HOUR_PRICE = 10;

@Component({
  selector: 'app-reservation-payment',
  imports: [NgIf, NgFor, FormsModule, TranslatePipe, SkeletonComponent, LoadErrorStateComponent],
  templateUrl: './reservation-payment.component.html',
  styleUrl: './reservation-payment.component.scss',
})
export class ReservationPaymentComponent implements OnInit, OnDestroy, CanComponentDeactivate {
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

  arena: Arena | null = null;
  arenaErrorKey = 'paymentPageLoadError';
  isProcessing = false;

  arenaId = 0;
  startTime: Date | null = null;
  durationInHours = 1;

  cardholderName = '';
  cardNumber = '';
  expiry = '';
  cvv = '';
  expiryPastDateError = false;

  readonly cardNumberPattern =
    '^(\\d{4} \\d{4} \\d{4} \\d{4}|\\d{4} \\d{6} \\d{5}|\\d{4} \\d{6} \\d{4}|\\d{4} \\d{4} \\d{4} \\d{4} \\d{3})$';

  private beforeUnloadHandlerBound = this.beforeUnloadHandler.bind(this);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private arenaService: ArenaService,
    private languageService: LanguageService,
    private reservationService: ReservationService,
    private toastService: ToastService,
    private confirmDialogService: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    window.addEventListener('beforeunload', this.beforeUnloadHandlerBound);
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.beforeUnloadHandlerBound);
  }

  get hasUnconfirmedPaymentInfo(): boolean {
    return !!(
      this.cardholderName.trim() ||
      this.cardNumber.trim() ||
      this.expiry.trim() ||
      this.cvv.trim()
    );
  }

  beforeUnloadHandler(event: BeforeUnloadEvent) {
    if (this.hasUnconfirmedPaymentInfo) {
      event.returnValue = this.languageService.translate('unsavedChangesConfirm');
    }
  }

  canDeactivate(): boolean | Observable<boolean> | Promise<boolean> {
    if (this.hasUnconfirmedPaymentInfo) {
      return this.confirmDialogService.confirm('unsavedChangesConfirm');
    }
    return true;
  }

  loadArena = () => {
    const queryParams = this.route.snapshot.queryParamMap;
    this.arenaId = Number(queryParams.get('arenaId'));
    const startTimeParam = queryParams.get('startTime');
    this.durationInHours = Number(queryParams.get('durationInHours')) || 1;

    if (!this.arenaId || !startTimeParam) {
      this.arenaErrorKey = 'paymentMissingDetails';
      return throwError(() => new Error('Missing payment details'));
    }

    this.startTime = new Date(startTimeParam);

    return this.arenaService.getArenaById(this.arenaId).pipe(
      tap((arena) => {
        this.arena = arena;
      }),
      catchError((error) => {
        console.error('Error loading arena for payment:', error);
        this.arenaErrorKey = error.status === 404 ? 'arenaNotFound' : 'paymentPageLoadError';
        return throwError(() => error);
      }),
    );
  }

  get currentLocale(): string {
    return this.localeByLanguage[this.languageService.currentLanguage] || 'en-US';
  }

  get endTime(): Date | null {
    if (!this.startTime) {
      return null;
    }

    return new Date(this.startTime.getTime() + this.durationInHours * 3600000);
  }

  get totalPrice(): number {
    if (!this.arena) {
      return 0;
    }

    const extraHalfHours = Math.max(0, Math.round((this.durationInHours - 1) / 0.5));
    return this.arena.pricePerHour + extraHalfHours * ADDITIONAL_HALF_HOUR_PRICE;
  }

  formatDateTime(date: Date | null): string {
    if (!date) {
      return '';
    }

    const month = this.languageService.translate(getMonthAbbreviationKey(date));
    const day = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(date);
    const weekday = this.languageService.translate(getWeekdayAbbreviationKey(date));

    return `${month} ${day}, ${weekday}`;
  }

  formatTime(date: Date | null): string {
    if (!date) {
      return '';
    }

    return new Intl.DateTimeFormat(this.currentLocale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }

  formatPrice(amount: number): string {
    return `${new Intl.NumberFormat(this.currentLocale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)} BAM`;
  }

  onCardNumberChange(rawValue: string, inputEl: HTMLInputElement): void {
    const cursorPosition = inputEl.selectionStart ?? rawValue.length;
    const digitsBeforeCursor = rawValue.slice(0, cursorPosition).replace(/\D/g, '').length;

    const digits = rawValue.replace(/\D/g, '').slice(0, 19);
    const formatted = this.formatCardNumber(digits);

    this.cardNumber = formatted;
    inputEl.value = formatted;

    let newCursorPosition = 0;
    let digitsSeen = 0;
    while (newCursorPosition < formatted.length && digitsSeen < digitsBeforeCursor) {
      if (/\d/.test(formatted[newCursorPosition])) {
        digitsSeen++;
      }
      newCursorPosition++;
    }
    inputEl.setSelectionRange(newCursorPosition, newCursorPosition);
  }

  onCvvChange(rawValue: string): void {
    this.cvv = rawValue.replace(/\D/g, '').slice(0, 4);
  }

  validateExpiry(): void {
    this.expiryPastDateError = false;

    const match = /^(0[1-9]|1[0-2])\/([0-9]{2})$/.exec(this.expiry);
    if (!match) {
      return;
    }

    const month = Number(match[1]);
    const year = 2000 + Number(match[2]);

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    this.expiryPastDateError = year < currentYear || (year === currentYear && month < currentMonth);
  }

  private formatCardNumber(digits: string): string {
    const groups = this.getCardNumberGroups(digits.length);
    const parts: string[] = [];
    let index = 0;

    for (const groupSize of groups) {
      if (index >= digits.length) {
        break;
      }

      parts.push(digits.slice(index, index + groupSize));
      index += groupSize;
    }

    if (index < digits.length) {
      parts.push(digits.slice(index));
    }

    return parts.join(' ');
  }

  private getCardNumberGroups(digitCount: number): number[] {
    switch (digitCount) {
      case 14:
        return [4, 6, 4];
      case 15:
        return [4, 6, 5];
      case 19:
        return [4, 4, 4, 4, 3];
      default:
        return [4, 4, 4, 4];
    }
  }

  submitPayment(form: NgForm): void {
    if (form.invalid || !this.startTime || this.isProcessing || this.expiryPastDateError) {
      return;
    }

    const digitsOnly = this.cardNumber.replace(/\D/g, '');
    const cardLast4 = digitsOnly.slice(-4);

    this.isProcessing = true;

    this.reservationService
      .createReservation({
        arenaId: this.arenaId,
        startTime: this.startTime.toISOString(),
        durationInHours: this.durationInHours,
        cardLast4,
      })
      .subscribe({
        next: (reservation) => {
          this.isProcessing = false;
          this.cardholderName = '';
          this.cardNumber = '';
          this.expiry = '';
          this.cvv = '';
          this.router.navigate(['/sports-arenas', this.arenaId], {
            queryParams: { justBooked: reservation.id },
          });
        },
        error: (error) => {
          this.isProcessing = false;
          const message = error?.error?.message || error?.error || this.languageService.translate('paymentGenericError');
          this.toastService.showError(typeof message === 'string' ? message : this.languageService.translate('paymentGenericError'));
        },
      });
  }

  goBack(): void {
    if (this.arenaId) {
      this.router.navigate(['/sports-arenas', this.arenaId]);
    } else {
      this.router.navigate(['/sports-arenas']);
    }
  }
}
