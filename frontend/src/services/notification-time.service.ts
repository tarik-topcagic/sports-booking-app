import { Injectable } from '@angular/core';
import { formatDate } from '@angular/common';
import { LanguageService } from './language.service';

const WEEKDAY_KEYS = [
  'weekdaySunday',
  'weekdayMonday',
  'weekdayTuesday',
  'weekdayWednesday',
  'weekdayThursday',
  'weekdayFriday',
  'weekdaySaturday',
];

const MONTH_KEYS = [
  'monthAbbrJan',
  'monthAbbrFeb',
  'monthAbbrMar',
  'monthAbbrApr',
  'monthAbbrMay',
  'monthAbbrJun',
  'monthAbbrJul',
  'monthAbbrAug',
  'monthAbbrSep',
  'monthAbbrOct',
  'monthAbbrNov',
  'monthAbbrDec',
];

@Injectable({
  providedIn: 'root',
})
export class NotificationTimeService {
  private readonly minuteInMs = 60 * 1000;
  private readonly hourInMinutes = 60;
  private readonly dayInHours = 24;
  private readonly dayInMs = 24 * 60 * 60 * 1000;

  constructor(private languageService: LanguageService) {}

  formatRelativeTime(createdAt: string | Date, compact = false, useLegacyRules = false): string {
    const created = this.parseNotificationDate(createdAt);
    const createdAtTime = created.getTime();

    if (Number.isNaN(createdAtTime)) {
      return '';
    }

    const now = new Date();
    const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - createdAtTime) / this.minuteInMs));

    if (elapsedMinutes < 1) {
      return this.languageService.translate('justNow');
    }

    if (elapsedMinutes < this.hourInMinutes) {
      return this.interpolate('minutesAgo', { count: elapsedMinutes.toString() });
    }

    const elapsedHours = Math.floor(elapsedMinutes / this.hourInMinutes);

    if (elapsedHours < this.dayInHours) {
      return this.interpolate('hoursAgo', { count: elapsedHours.toString() });
    }

    const dayDiff = this.calendarDayDifference(now, created);
    const time = formatDate(created, 'HH:mm', 'en-US');

    if (dayDiff <= 1) {
      return compact
        ? this.languageService.translate('yesterday')
        : `${this.languageService.translate('yesterday')}, ${time}`;
    }

    if (dayDiff <= 6) {
      const weekdayLabel = this.languageService.translate(WEEKDAY_KEYS[created.getDay()]);
      return compact ? weekdayLabel : `${weekdayLabel}, ${time}`;
    }

    if (useLegacyRules) {
      const datePattern = created.getFullYear() === now.getFullYear() ? 'dd.MM.' : 'dd.MM.yyyy.';
      const dateLabel = formatDate(created, datePattern, 'en-US');

      return compact ? dateLabel : `${dateLabel} ${time}`;
    }

    if (dayDiff <= 14) {
      return this.languageService.translate('oneWeekAgo');
    }

    if (dayDiff <= 20) {
      return this.languageService.translate('twoWeeksAgo');
    }

    const day = formatDate(created, 'dd', 'en-US');
    const monthLabel = this.languageService.translate(MONTH_KEYS[created.getMonth()]);
    const dateLabel = created.getFullYear() === now.getFullYear()
      ? `${day} ${monthLabel}`
      : `${day} ${monthLabel} ${created.getFullYear()}`;

    return compact ? dateLabel : `${dateLabel} ${time}`;
  }

  private calendarDayDifference(now: Date, created: Date): number {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfCreatedDay = new Date(created.getFullYear(), created.getMonth(), created.getDate()).getTime();

    return Math.max(1, Math.round((startOfToday - startOfCreatedDay) / this.dayInMs));
  }

  private parseNotificationDate(value: string | Date): Date {
    if (value instanceof Date) {
      return value;
    }

    const hasTimezone = /(?:z|[+-]\d{2}:?\d{2})$/i.test(value);
    return new Date(hasTimezone ? value : `${value}Z`);
  }

  private interpolate(key: string, values: Record<string, string>): string {
    return Object.entries(values).reduce(
      (text, [name, value]) => text.replace(`{${name}}`, value),
      this.languageService.translate(key),
    );
  }
}
