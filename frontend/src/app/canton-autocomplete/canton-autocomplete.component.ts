import { AfterViewInit, Component, Input, OnInit, ViewChild, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Canton } from '../interfaces/canton';
import { CantonService } from '../../services/canton.service';
import { SearchableDropdownComponent } from '../searchable-dropdown/searchable-dropdown.component';

@Component({
  selector: 'app-canton-autocomplete',
  standalone: true,
  imports: [SearchableDropdownComponent],
  templateUrl: './canton-autocomplete.component.html',
  host: { '[attr.id]': 'null' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CantonAutocompleteComponent),
      multi: true,
    },
  ],
})
export class CantonAutocompleteComponent implements ControlValueAccessor, OnInit, AfterViewInit {
  @Input() id = '';
  @ViewChild(SearchableDropdownComponent) private dropdownRef!: SearchableDropdownComponent<Canton>;

  cantons: Canton[] = [];
  cantonsLoaded = false;
  disabled = false;
  selectedCantonId: number | null = null;

  readonly itemLabel = (canton: Canton): string => canton.name;

  constructor(private cantonService: CantonService) {}

  ngOnInit(): void {
    this.cantonService.getCantons().subscribe((cantons) => {
      this.cantons = cantons;
      this.cantonsLoaded = true;
      this.resolveDisplayText();
    });
  }

  ngAfterViewInit(): void {
    this.resolveDisplayText();
  }

  private resolveDisplayText(): void {
    if (this.selectedCantonId == null) {
      return;
    }
    const match = this.cantons.find((canton) => canton.id === this.selectedCantonId);
    this.dropdownRef?.setDisplayValue(match ? match.name : '');
  }

  onCantonSelected(canton: Canton): void {
    this.selectedCantonId = canton.id;
    this.onChange(this.selectedCantonId);
  }

  onSelectionCleared(): void {
    this.selectedCantonId = null;
    this.onChange(this.selectedCantonId);
  }

  onTouchedHandler(): void {
    this.onTouched();
  }

  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(cantonId: number | null): void {
    this.selectedCantonId = cantonId ?? null;
    if (this.selectedCantonId == null) {
      this.dropdownRef?.setDisplayValue('');
      return;
    }
    this.resolveDisplayText();
  }

  registerOnChange(fn: (value: number | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
