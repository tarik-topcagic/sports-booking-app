import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { MessageActionsCoordinatorService } from './message-actions-coordinator.service';

@Injectable({
  providedIn: 'root',
})
export class DropdownCoordinatorService {
  private activeId: unknown = null;
  private activeElement: HTMLElement | null = null;
  private readonly activeChangedSubject = new Subject<unknown>();
  readonly activeChanged$ = this.activeChangedSubject.asObservable();

  private readonly onDocumentClick = (event: MouseEvent): void => {
    if (this.activeId === null) {
      return;
    }

    const target = event.target as Node | null;

    if (target && this.activeElement?.contains(target)) {
      return;
    }

    this.close(this.activeId);
  };

  private readonly onKeydown = (event: KeyboardEvent): void => {
    if (event.key === 'Escape' && this.activeId !== null) {
      this.close(this.activeId);
    }
  };

  constructor(private messageActionsCoordinator: MessageActionsCoordinatorService) {
    document.addEventListener('click', this.onDocumentClick, true);
    document.addEventListener('keydown', this.onKeydown, true);
  }

  open(id: unknown, element: HTMLElement): void {
    if (this.activeId === id) {
      return;
    }

    this.activeId = id;
    this.activeElement = element;
    this.messageActionsCoordinator.clearAllActive();
    this.activeChangedSubject.next(id);
  }

  close(id: unknown): void {
    if (this.activeId !== id) {
      return;
    }

    this.activeId = null;
    this.activeElement = null;
    this.activeChangedSubject.next(null);
  }
}
