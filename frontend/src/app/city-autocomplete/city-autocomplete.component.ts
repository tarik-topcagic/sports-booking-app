import { AfterViewInit, Component, Input, OnInit, ViewChild, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { City } from '../interfaces/city';
import { CityService } from '../../services/city.service';
import { SearchableDropdownComponent } from '../searchable-dropdown/searchable-dropdown.component';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-city-autocomplete',
  standalone: true,
  imports: [SearchableDropdownComponent, TranslatePipe],
  templateUrl: './city-autocomplete.component.html',
  host: { '[attr.id]': 'null' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CityAutocompleteComponent),
      multi: true,
    },
  ],
})
export class CityAutocompleteComponent implements ControlValueAccessor, OnInit, AfterViewInit {
  @Input() id = '';
  @ViewChild(SearchableDropdownComponent) private dropdownRef!: SearchableDropdownComponent<City>;

  cities: City[] = [];
  citiesLoaded = false;
  disabled = false;
  selectedCityId: number | null = null;

  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  readonly itemLabel = (city: City): string => `${city.name}, ${city.canton}`;
  readonly matchValue = (city: City): string => city.name;
  readonly filterPredicate = (city: City, query: string): boolean => city.name.toLowerCase().includes(query);

  constructor(private cityService: CityService) {}

  ngOnInit(): void {
    this.cityService.getCities().subscribe((cities) => {
      this.cities = cities;
      this.citiesLoaded = true;
      this.resolveDisplayText();
    });
  }

  ngAfterViewInit(): void {
    this.resolveDisplayText();
  }

  private resolveDisplayText(): void {
    if (this.selectedCityId == null) {
      return;
    }
    const match = this.cities.find((city) => city.id === this.selectedCityId);
    this.dropdownRef?.setDisplayValue(match ? match.name : '');
  }

  onCitySelected(city: City): void {
    this.selectedCityId = city.id;
    this.onChange(this.selectedCityId);
  }

  onSelectionCleared(): void {
    this.selectedCityId = null;
    this.onChange(this.selectedCityId);
  }

  onTouchedHandler(): void {
    this.onTouched();
  }

  writeValue(cityId: number | null): void {
    this.selectedCityId = cityId ?? null;
    if (this.selectedCityId == null) {
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
