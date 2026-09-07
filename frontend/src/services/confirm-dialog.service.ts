import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ConfirmDialogState, ConfirmDialogOptions } from '../app/interfaces/confirm-dialog.model';

@Injectable({
  providedIn: 'root',
})
export class ConfirmDialogService {
  private stateSubject = new BehaviorSubject<ConfirmDialogState>({
    visible: false,
    messageKey: '',
  });

  state$ = this.stateSubject.asObservable();

  confirm(messageKey: string, options: ConfirmDialogOptions = {}): Promise<boolean> {
    return new Promise((resolve) => {
      this.stateSubject.next({
        visible: true,
        messageKey,
        previewName: options.previewName,
        previewImageUrl: options.previewImageUrl,
        resolve,
      });
    });
  }

  close(confirmed: boolean): void {
    const state = this.stateSubject.value;
    state.resolve?.(confirmed);
    this.stateSubject.next({
      visible: false,
      messageKey: '',
      previewName: undefined,
      previewImageUrl: undefined,
    });
  }
}
