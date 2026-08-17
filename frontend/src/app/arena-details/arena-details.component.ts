import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, from, of, switchMap, tap, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  getArenaDescriptionTranslationKey,
  getArenaGalleryImages,
  getArenaDisplayImage,
} from '../helpers/arena-ui.helper';
import { formatReadableDate, getReadableMonthLabel } from '../helpers/date-format.helper';
import { Arena } from '../interfaces/arena.model';
import { Reservation } from '../interfaces/reservation.model';
import { TimeRange } from '../interfaces/availability.model';
import { NavbarComponent } from '../navbar/navbar.component';
import { TranslatePipe } from '../pipes/translate.pipe';
import { SkeletonComponent } from '../skeleton/skeleton/skeleton.component';
import { SkeletonCalendarGridComponent } from '../skeleton/skeleton-calendar-grid/skeleton-calendar-grid.component';
import { SkeletonTextBlockComponent } from '../skeleton/skeleton-text-block/skeleton-text-block.component';
import { LoadErrorStateComponent } from '../load-error-state/load-error-state.component';
import { ArenaService } from '../../services/arena.service';
import { LanguageService } from '../../services/language.service';
import { ReservationService } from '../../services/reservation.service';
import { FavoriteArenaService } from '../../services/favorite-arena.service';
import { ToastService } from '../../services/toast.service';

interface ReservationDay {
  index: number;
  date: Date;
}

type ReservationCardState = 'placeholder' | 'selecting' | 'confirmed';

const ADDITIONAL_HALF_HOUR_PRICE = 10;
const MIN_ADVANCE_BOOKING_MINUTES = 30;
const MIN_DURATION_HOURS = 1;
const AVAILABILITY_REFRESH_MS = 45000;
const CLOSING_HOUR = 23;

@Component({
  selector: 'app-arena-details',
  imports: [
    NgIf,
    NgFor,
    NgClass,
    NavbarComponent,
    TranslatePipe,
    SkeletonComponent,
    SkeletonCalendarGridComponent,
    SkeletonTextBlockComponent,
    LoadErrorStateComponent,
  ],
  templateUrl: './arena-details.component.html',
  styleUrl: './arena-details.component.scss',
})
export class ArenaDetailsComponent implements OnInit, OnDestroy {
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
  arenaErrorKey = 'arenaDetailsLoadError';
  showFullWeek = false;
  selectedDateIndex = 0;
  selectedSlotStart: number | null = null;
  isGalleryOpen = false;
  activeGalleryIndex = 0;
  galleryImageUrls: string[] = [];
  isMobileSummaryOpen = false;
  viewportWidth =
    typeof window !== 'undefined' ? window.innerWidth : 1280;

  readonly timeSlots = Array.from({ length: 16 }, (_, index) => index + 7);
  readonly reservationDays = this.createReservationDays();
  readonly durationOptions = [1, 1.5, 2];

  selectedDurationHours = 1;
  myReservations: Reservation[] = [];
  justBookedReservation: Reservation | null = null;
  isBusyLoadingAvailability = false;
  isTogglingFavorite = false;

  private busyRangesByDate = new Map<string, TimeRange[]>();
  private refreshIntervalId: ReturnType<typeof setInterval> | null = null;
  private arenaId = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private arenaService: ArenaService,
    private languageService: LanguageService,
    private reservationService: ReservationService,
    private favoriteArenaService: FavoriteArenaService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.initializeMockSelection();

    this.favoriteArenaService.getMyFavorites().subscribe({
      error: (error) => console.error('Error loading favorites:', error),
    });

    this.refreshIntervalId = setInterval(() => {
      this.loadAvailabilityForVisibleDays(true);
      this.loadMyReservations();
    }, AVAILABILITY_REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.refreshIntervalId !== null) {
      clearInterval(this.refreshIntervalId);
    }
  }

  loadArenaDetails = () => {
    this.arenaId = Number(this.route.snapshot.paramMap.get('id'));

    if (!this.arenaId) {
      this.arenaErrorKey = 'arenaNotFound';
      return throwError(() => new Error('Missing arena id'));
    }

    return this.arenaService.getArenaById(this.arenaId).pipe(
      switchMap((arena) => from(this.resolveGalleryImages(arena)).pipe(
        tap((galleryImageUrls) => {
          this.arena = arena;
          this.galleryImageUrls = galleryImageUrls;
          this.loadAvailabilityForVisibleDays();
          this.loadMyReservations();
        }),
      )),
      catchError((error) => {
        console.error('Error loading arena details:', error);
        this.arenaErrorKey = error.status === 404 ? 'arenaNotFound' : 'arenaDetailsLoadError';
        return throwError(() => error);
      }),
    );
  }

  @HostListener('window:focus')
  handleWindowFocus(): void {
    this.loadAvailabilityForVisibleDays(true);
    this.loadMyReservations();
  }

  goBack(): void {
    this.router.navigate(['/sports-arenas']);
  }

  getArenaImageUrl(): string {
    return this.arena ? getArenaDisplayImage(this.arena) : '';
  }

  getArenaDescription(): string {
    return this.arena ? getArenaDescriptionTranslationKey(this.arena) : '';
  }

  get visibleDays(): ReservationDay[] {
    return this.showFullWeek
      ? this.reservationDays
      : this.reservationDays.slice(0, 5);
  }

  get selectedDay(): ReservationDay | null {
    return this.reservationDays[this.selectedDateIndex] ?? null;
  }

  get computedPrice(): number {
    if (!this.arena) {
      return 0;
    }

    const extraHalfHours = Math.max(0, Math.round((this.selectedDurationHours - 1) / 0.5));
    return this.arena.pricePerHour + extraHalfHours * ADDITIONAL_HALF_HOUR_PRICE;
  }

  get currentLocale(): string {
    return this.localeByLanguage[this.languageService.currentLanguage] || 'en-US';
  }

  get isMobileLayout(): boolean {
    return this.viewportWidth <= 767.98;
  }

  get galleryImages(): string[] {
    return this.galleryImageUrls;
  }

  get activeGalleryImage(): string {
    return this.galleryImages[this.activeGalleryIndex] || this.getArenaImageUrl();
  }

  get isFavorite(): boolean {
    return this.arena ? this.favoriteArenaService.isFavorite(this.arena.id) : false;
  }

  get reservationCardState(): ReservationCardState {
    if (this.justBookedReservation) {
      return 'confirmed';
    }

    return this.selectedSlotStart !== null ? 'selecting' : 'placeholder';
  }

  get displayDate(): Date | null {
    if (this.justBookedReservation) {
      return new Date(this.justBookedReservation.startTime);
    }

    return this.selectedDay?.date ?? null;
  }

  get displayTimeRange(): string {
    if (this.justBookedReservation) {
      return this.formatReservationTimeRange(this.justBookedReservation);
    }

    return this.formatSelectedTimeRange();
  }

  get displayPrice(): number {
    if (this.justBookedReservation && this.arena) {
      const extraHalfHours = Math.max(
        0,
        Math.round((this.justBookedReservation.durationInHours - 1) / 0.5),
      );
      return this.arena.pricePerHour + extraHalfHours * ADDITIONAL_HALF_HOUR_PRICE;
    }

    return this.computedPrice;
  }

  toggleWeekView(): void {
    this.showFullWeek = !this.showFullWeek;
    this.loadAvailabilityForVisibleDays();
  }

  openGallery(startIndex = 0): void {
    if (!this.galleryImages.length) {
      return;
    }

    this.activeGalleryIndex = Math.min(
      Math.max(startIndex, 0),
      this.galleryImages.length - 1,
    );
    this.isGalleryOpen = true;
  }

  closeGallery(): void {
    this.isGalleryOpen = false;
  }

  closeMobileSummary(): void {
    this.isMobileSummaryOpen = false;
  }

  showPreviousImage(): void {
    if (this.galleryImages.length < 2) {
      return;
    }

    this.activeGalleryIndex =
      (this.activeGalleryIndex - 1 + this.galleryImages.length) % this.galleryImages.length;
  }

  showNextImage(): void {
    if (this.galleryImages.length < 2) {
      return;
    }

    this.activeGalleryIndex = (this.activeGalleryIndex + 1) % this.galleryImages.length;
  }

  selectDay(dayIndex: number): void {
    this.selectedDateIndex = dayIndex;
    this.justBookedReservation = null;

    if (this.selectedSlotStart === null) {
      return;
    }

    if (!this.isSlotAvailable(dayIndex, this.selectedSlotStart, MIN_DURATION_HOURS)) {
      this.selectedSlotStart =
        this.timeSlots.find((slot) => this.isSlotAvailable(dayIndex, slot, MIN_DURATION_HOURS)) ??
        null;
    }

    if (
      this.selectedSlotStart !== null &&
      !this.isSlotAvailable(dayIndex, this.selectedSlotStart, this.selectedDurationHours)
    ) {
      this.selectedDurationHours = MIN_DURATION_HOURS;
    }
  }

  selectSlot(dayIndex: number, slotStart: number): void {
    if (!this.isSlotAvailable(dayIndex, slotStart, MIN_DURATION_HOURS)) {
      return;
    }

    const isNewSlot = this.selectedDateIndex !== dayIndex || this.selectedSlotStart !== slotStart;

    this.selectedDateIndex = dayIndex;
    this.selectedSlotStart = slotStart;
    this.justBookedReservation = null;

    if (isNewSlot) {
      this.selectedDurationHours = MIN_DURATION_HOURS;
    }

    if (this.isMobileLayout) {
      this.isMobileSummaryOpen = true;
    }
  }

  selectDuration(hours: number): void {
    if (!this.isDurationAvailableForSelectedSlot(hours)) {
      return;
    }

    this.selectedDurationHours = hours;
  }

  isDurationAvailableForSelectedSlot(hours: number): boolean {
    if (this.selectedSlotStart === null) {
      return true;
    }

    return this.isSlotAvailable(this.selectedDateIndex, this.selectedSlotStart, hours);
  }

  isSlotInPast(dayIndex: number, slotStart: number): boolean {
    const day = this.reservationDays[dayIndex];
    if (!day) {
      return false;
    }

    const slotDate = this.buildSlotDate(day.date, slotStart);
    const minBookableTime = new Date(Date.now() + MIN_ADVANCE_BOOKING_MINUTES * 60000);
    return slotDate <= minBookableTime;
  }

  isSlotAvailable(
    dayIndex: number,
    slotStart: number,
    durationHours: number = this.selectedDurationHours,
  ): boolean {
    if (this.isSlotInPast(dayIndex, slotStart)) {
      return false;
    }

    if (slotStart + durationHours > CLOSING_HOUR) {
      return false;
    }

    const day = this.reservationDays[dayIndex];
    if (!day) {
      return false;
    }

    const slotStartDate = this.buildSlotDate(day.date, slotStart);
    const slotEndDate = new Date(slotStartDate.getTime() + durationHours * 3600000);
    const busyRanges = this.busyRangesByDate.get(this.dateKey(day.date)) ?? [];

    return !busyRanges.some((range) => {
      const rangeStart = new Date(range.startTime);
      const rangeEnd = new Date(range.endTime);
      return slotStartDate < rangeEnd && rangeStart < slotEndDate;
    });
  }

  isSlotMine(dayIndex: number, slotStart: number): boolean {
    const day = this.reservationDays[dayIndex];
    if (!day || !this.arena) {
      return false;
    }

    const slotStartDate = this.buildSlotDate(day.date, slotStart);

    return this.myReservations.some((reservation) => {
      if (reservation.status !== 'Confirmed' || reservation.arenaId !== this.arena!.id) {
        return false;
      }

      const reservationStart = new Date(reservation.startTime);
      const reservationEnd = new Date(reservation.endTime);
      const slotEndDate = new Date(slotStartDate.getTime() + 3600000);
      return slotStartDate < reservationEnd && reservationStart < slotEndDate;
    });
  }

  isSelectedSlot(dayIndex: number, slotStart: number): boolean {
    if (this.selectedDateIndex !== dayIndex || this.selectedSlotStart === null) {
      return false;
    }

    return (
      slotStart >= this.selectedSlotStart &&
      slotStart < this.selectedSlotStart + this.selectedDurationHours
    );
  }

  formatDayLabel(date: Date): string {
    if (this.isSameDay(date, new Date())) {
      return this.languageService.translate('today');
    }

    return this.capitalize(
      new Intl.DateTimeFormat(this.currentLocale, {
        weekday: 'short',
      }).format(date),
    );
  }

  formatDayDate(date: Date): string {
    const month = getReadableMonthLabel(date, this.currentLocale);
    const day = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
    }).format(date);

    return `${month} ${day}`;
  }

  formatFullDate(date: Date | null): string {
    if (!date) {
      return this.languageService.translate('notSelected');
    }

    return formatReadableDate(date, this.currentLocale);
  }

  formatTimeLabel(slotStart: number): string {
    return `${String(slotStart).padStart(2, '0')}:00`;
  }

  formatTimeRange(slotStart: number | null): string {
    if (slotStart === null) {
      return this.languageService.translate('notSelected');
    }

    return `${this.formatTimeLabel(slotStart)} - ${this.formatTimeLabel(slotStart + 1)}`;
  }

  formatSelectedTimeRange(): string {
    if (this.selectedSlotStart === null) {
      return this.languageService.translate('notSelected');
    }

    const endHour = this.selectedSlotStart + this.selectedDurationHours;
    const endLabel = Number.isInteger(endHour)
      ? this.formatTimeLabel(endHour)
      : `${String(Math.floor(endHour)).padStart(2, '0')}:30`;

    return `${this.formatTimeLabel(this.selectedSlotStart)} - ${endLabel}`;
  }

  formatReservationTimeRange(reservation: Reservation): string {
    const start = new Date(reservation.startTime);
    const end = new Date(reservation.endTime);
    const formatter = new Intl.DateTimeFormat(this.currentLocale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    return `${formatter.format(start)} - ${formatter.format(end)}`;
  }

  getSessionLabel(): string {
    const durationHours = this.justBookedReservation?.durationInHours ?? this.selectedDurationHours;

    if (durationHours === 1) {
      return this.languageService.translate('hourlySession');
    }

    return this.languageService
      .translate('multiHourSession')
      .replace('{hours}', String(durationHours));
  }

  formatPrice(amount: number): string {
    return `${new Intl.NumberFormat(this.currentLocale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)} BAM`;
  }

  getScheduleGridTemplate(): string {
    if (this.isMobileLayout) {
      return `56px repeat(${this.visibleDays.length}, 132px)`;
    }

    return `88px repeat(${this.visibleDays.length}, minmax(140px, 1fr))`;
  }

  trackDay(index: number, day: ReservationDay): number {
    return day.index;
  }

  trackTime(index: number, slotStart: number): number {
    return slotStart;
  }

  trackImage(index: number, imageUrl: string): string {
    return imageUrl;
  }

  goToPayment(): void {
    if (!this.arena || this.selectedSlotStart === null || !this.selectedDay) {
      return;
    }

    const startTime = this.buildSlotDate(this.selectedDay.date, this.selectedSlotStart);

    this.router.navigate(['/payment'], {
      queryParams: {
        arenaId: this.arena.id,
        startTime: startTime.toISOString(),
        durationInHours: this.selectedDurationHours,
      },
    });
  }

  toggleFavorite(): void {
    if (!this.arena || this.isTogglingFavorite) {
      return;
    }

    const arenaId = this.arena.id;
    this.isTogglingFavorite = true;

    if (this.isFavorite) {
      this.favoriteArenaService.removeFavorite(arenaId).subscribe({
        next: () => {
          this.isTogglingFavorite = false;
          this.toastService.showSuccess(this.languageService.translate('removedFromFavorites'));
        },
        error: () => {
          this.isTogglingFavorite = false;
          this.toastService.showError(this.languageService.translate('favoriteActionError'));
        },
      });
    } else {
      this.favoriteArenaService.addFavorite(arenaId).subscribe({
        next: () => {
          this.isTogglingFavorite = false;
          this.toastService.showSuccess(this.languageService.translate('addedToFavorites'));
        },
        error: () => {
          this.isTogglingFavorite = false;
          this.toastService.showError(this.languageService.translate('favoriteActionError'));
        },
      });
    }
  }

  private loadAvailabilityForVisibleDays(silent = false): void {
    const days = this.visibleDays;
    if (!days.length || !this.arenaId) {
      return;
    }

    if (!silent) {
      this.isBusyLoadingAvailability = true;
    }

    forkJoin(
      days.map((day) => {
        const key = this.dateKey(day.date);
        return this.reservationService.getAvailability(this.arenaId, key).pipe(
          map((ranges) => ({ key, ranges })),
          catchError((error) => {
            console.error('Error loading availability:', error);
            return of({ key, ranges: [] as TimeRange[] });
          }),
        );
      }),
    ).subscribe((results) => {
      results.forEach(({ key, ranges }) => this.busyRangesByDate.set(key, ranges));
      this.isBusyLoadingAvailability = false;
    });
  }

  private loadMyReservations(): void {
    this.reservationService.getMyReservations().subscribe({
      next: (reservations) => {
        this.myReservations = reservations;
        this.applyJustBookedFromQueryParam();
      },
      error: (error) => console.error('Error loading my reservations:', error),
    });
  }

  private applyJustBookedFromQueryParam(): void {
    const justBookedId = Number(this.route.snapshot.queryParamMap.get('justBooked'));
    if (!justBookedId) {
      return;
    }

    const reservation = this.myReservations.find((r) => r.id === justBookedId);
    if (reservation) {
      this.justBookedReservation = reservation;
      this.selectedSlotStart = null;
      this.toastService.showSuccess(this.languageService.translate('reservationBookedSuccess'));

      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: {},
        replaceUrl: true,
      });
    }
  }

  private buildSlotDate(date: Date, hour: number): Date {
    const wholeHour = Math.floor(hour);
    const minutes = Math.round((hour - wholeHour) * 60);
    const result = new Date(date);
    result.setHours(wholeHour, minutes, 0, 0);
    return result;
  }

  private dateKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  @HostListener('window:resize')
  handleResize(): void {
    this.viewportWidth = window.innerWidth;

    if (!this.isMobileLayout) {
      this.isMobileSummaryOpen = false;
    }
  }

  private createReservationDays(): ReservationDay[] {
    const startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);

      return {
        index,
        date,
      };
    });
  }

  private initializeMockSelection(): void {
    this.selectedSlotStart = null;
    this.isMobileSummaryOpen = false;
  }

  private async resolveGalleryImages(arena: Arena): Promise<string[]> {
    const candidates = getArenaGalleryImages(arena);
    const results = await Promise.all(
      candidates.map(async (imageUrl) => ({
        imageUrl,
        isValid: await this.canLoadImage(imageUrl),
      })),
    );

    const validImages = results
      .filter((result) => result.isValid)
      .map((result) => result.imageUrl);

    return validImages.length ? validImages : [getArenaDisplayImage(arena)].filter(Boolean);
  }

  private canLoadImage(imageUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = imageUrl;
    });
  }

  private isSameDay(left: Date, right: Date): boolean {
    return (
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate()
    );
  }

  private capitalize(value: string): string {
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : value;
  }
}
