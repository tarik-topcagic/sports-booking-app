import { Pipe, PipeTransform } from '@angular/core';
import { NotificationTimeService } from '../../services/notification-time.service';

@Pipe({
  name: 'relativeTime',
  standalone: true,
})
export class RelativeTimePipe implements PipeTransform {
  constructor(private notificationTimeService: NotificationTimeService) {}

  transform(value: string | Date | null | undefined, compact = false, useLegacyRules = false): string {
    if (!value) {
      return '';
    }

    return this.notificationTimeService.formatRelativeTime(value, compact, useLegacyRules);
  }
}
