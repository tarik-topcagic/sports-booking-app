import { NgFor, NgIf } from '@angular/common';
import { Component, ElementRef, Input, OnDestroy } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DropdownCoordinatorService } from '../../services/dropdown-coordinator.service';

export interface AdminSelectOption {
  value: string;
  label: string;
}

@Component({
  selector: 'app-admin-select',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './admin-select.component.html',
  styleUrl: './admin-select.component.scss',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: AdminSelectComponent,
      multi: true,
    },
  ],
})
export class AdminSelectComponent implements ControlValueAccessor, OnDestroy {
  @Input() options: AdminSelectOption[] = [];

  value = '';
  isOpen = false;
  disabled = false;

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};
  private readonly coordinatorSubscription: Subscription;

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private dropdownCoordinator: DropdownCoordinatorService,
  ) {
    this.coordinatorSubscription = this.dropdownCoordinator.activeChanged$.subscribe((activeId) => {
      if (activeId !== this && this.isOpen) {
        this.isOpen = false;
        this.onTouched();
      }
    });
  }

  ngOnDestroy(): void {
    this.coordinatorSubscription.unsubscribe();
    this.dropdownCoordinator.close(this);
  }

  get selectedLabel(): string {
    const match = this.options.find((option) => option.value === this.value);
    return match ? match.label : (this.options[0]?.label ?? '');
  }

  toggle(): void {
    if (this.disabled) {
      return;
    }
    if (this.isOpen) {
      this.close();
    } else {
      this.dropdownCoordinator.open(this, this.elementRef.nativeElement);
      this.isOpen = true;
    }
  }

  select(option: AdminSelectOption): void {
    this.value = option.value;
    this.onChange(this.value);
    this.close();
  }

  private close(): void {
    this.isOpen = false;
    this.dropdownCoordinator.close(this);
    this.onTouched();
  }

  writeValue(value: string): void {
    this.value = value ?? '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
