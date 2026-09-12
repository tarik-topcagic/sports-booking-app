import { Component, ElementRef, Input, OnDestroy, OnInit, forwardRef } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subscription } from 'rxjs';
import { City } from '../interfaces/city';
import { CityService } from '../../services/city.service';
import { DropdownCoordinatorService } from '../../services/dropdown-coordinator.service';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-city-autocomplete',
  standalone: true,
  imports: [NgFor, NgIf, TranslatePipe],
  templateUrl: './city-autocomplete.component.html',
  styleUrl: './city-autocomplete.component.scss',
  host: { '[attr.id]': 'null' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CityAutocompleteComponent),
      multi: true,
    },
  ],
})
export class CityAutocompleteComponent implements ControlValueAccessor, OnInit, OnDestroy {
  @Input() id = '';

  cities: City[] = [];
  value = '';
  selectedCityId: number | null = null;
  showSuggestions = false;
  disabled = false;
  citiesLoaded = false;

  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};
  private coordinatorSubscription?: Subscription;

  constructor(
    private cityService: CityService,
    private elementRef: ElementRef<HTMLElement>,
    private dropdownCoordinator: DropdownCoordinatorService,
  ) {
    this.coordinatorSubscription = this.dropdownCoordinator.activeChanged$.subscribe((activeId) => {
      if (activeId !== this && this.showSuggestions) {
        this.showSuggestions = false;
      }
    });
  }

  ngOnInit(): void {
    this.cityService.getCities().subscribe((cities) => {
      this.cities = cities;
      this.citiesLoaded = true;
      this.resolveDisplayText();
    });
  }

  ngOnDestroy(): void {
    this.coordinatorSubscription?.unsubscribe();
    this.dropdownCoordinator.close(this);
  }

  get filteredCities(): City[] {
    const query = this.value.trim().toLowerCase();
    if (!query) {
      return this.cities;
    }
    return this.cities.filter((city) => city.name.toLowerCase().includes(query));
  }

  private resolveDisplayText(): void {
    if (this.selectedCityId == null) {
      return;
    }
    const match = this.cities.find((city) => city.id === this.selectedCityId);
    this.value = match ? match.name : '';
  }

  onInput(text: string): void {
    this.value = text;
    this.showSuggestions = true;
    this.dropdownCoordinator.open(this, this.elementRef.nativeElement);

    const match = this.cities.find((city) => city.name === text.trim());
    this.selectedCityId = match ? match.id : null;

    this.onChange(this.selectedCityId);
  }

  onFocus(): void {
    this.showSuggestions = true;
    this.dropdownCoordinator.open(this, this.elementRef.nativeElement);
  }

  onBlur(): void {
    this.onTouched();
  }

  selectCity(city: City): void {
    this.value = city.name;
    this.selectedCityId = city.id;
    this.showSuggestions = false;
    this.dropdownCoordinator.close(this);
    this.onChange(this.selectedCityId);
    this.onTouched();
  }

  writeValue(cityId: number | null): void {
    this.selectedCityId = cityId ?? null;
    if (this.selectedCityId == null) {
      this.value = '';
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
