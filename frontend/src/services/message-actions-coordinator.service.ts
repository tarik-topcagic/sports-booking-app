import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class MessageActionsCoordinatorService {
  private activeInstance: unknown = null;
  private readonly activeChangedSubject = new Subject<unknown>();
  readonly activeChanged$ = this.activeChangedSubject.asObservable();

  setActive(instance: unknown): void {
    if (this.activeInstance === instance) {
      return;
    }

    this.activeInstance = instance;
    this.activeChangedSubject.next(instance);
  }

  clearActive(instance: unknown): void {
    if (this.activeInstance !== instance) {
      return;
    }

    this.activeInstance = null;
  }

  clearAllActive(): void {
    if (this.activeInstance === null) {
      return;
    }

    this.activeInstance = null;
    this.activeChangedSubject.next(null);
  }
}
