import { Component, Input, OnInit } from '@angular/core';
import { NgClass, NgIf } from '@angular/common';
import { Observable } from 'rxjs';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-load-error-state',
  imports: [NgIf, NgClass, TranslatePipe],
  templateUrl: './load-error-state.component.html',
  styleUrl: './load-error-state.component.scss',
})
export class LoadErrorStateComponent implements OnInit {
  @Input({ required: true }) load!: () => Observable<unknown>;
  @Input() errorKey: string | null = null;
  @Input() errorText: string | null = null;
  @Input() retryLabel: string | null = null;
  @Input() errorWrapperClass = '';
  @Input() errorWrapperStyle = '';

  isLoading = false;
  hasError = false;

  ngOnInit(): void {
    this.run();
  }

  retry(): void {
    if (this.isLoading) {
      return;
    }

    this.run();
  }

  reload(): void {
    this.run();
  }

  private run(): void {
    this.isLoading = true;
    this.hasError = false;
    this.load().subscribe({
      next: () => {
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.hasError = true;
      },
    });
  }
}
