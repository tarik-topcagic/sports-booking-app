import { Pipe, PipeTransform } from '@angular/core';
import { NotificationTimeService } from '../../services/notification-time.service';

@Pipe({
  name: 'liveRelativeTime',
  standalone: true,
  pure: false,
})
export class LiveRelativeTimePipe implements PipeTransform {
  constructor(private notificationTimeService: NotificationTimeService) {}

  transform(value: string | Date | null | undefined, compact = false, useLegacyRules = false): string {
    if (!value) {
      return '';
    }

    return this.notificationTimeService.formatRelativeTime(value, compact, useLegacyRules);
  }
}
