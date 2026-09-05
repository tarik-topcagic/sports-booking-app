import { AfterViewInit, Component, ElementRef, forwardRef, Input, OnDestroy, OnInit, Renderer2, ViewChild, ViewEncapsulation } from '@angular/core';
import { NgFor } from '@angular/common';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { City } from '../interfaces/city';
import { CityService } from '../../services/city.service';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-city-autocomplete',
  standalone: true,
  imports: [NgFor, TranslatePipe],
  templateUrl: './city-autocomplete.component.html',
  styleUrl: './city-autocomplete.component.scss',
  host: { '[attr.id]': 'null' },
  encapsulation: ViewEncapsulation.None,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CityAutocompleteComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => CityAutocompleteComponent),
      multi: true,
    },
  ],
})
export class CityAutocompleteComponent implements ControlValueAccessor, Validator, OnInit, AfterViewInit, OnDestroy {
  @Input() id = '';
  @Input() menuBehindBottomNavbar = false;
  @ViewChild('inputEl') inputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('menuEl') menuRef!: ElementRef<HTMLElement>;

  cities: City[] = [];
  value = '';
  selectedCityId: number | null = null;
  showSuggestions = false;
  disabled = false;
  menuPlacement: 'below' | 'above' = 'below';
  menuTop = 0;
  menuBottom = 0;
  menuLeft = 0;
  menuWidth = 0;

  private static readonly MENU_MAX_HEIGHT = 240; 
  private static readonly MENU_GAP = 0.65 * 16; 

  private citiesLoaded = false;
  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};
  private onValidatorChange: () => void = () => {};
  private handleClickOutsideBound = this.handleClickOutside.bind(this);
  private handleReflowBound = this.handleReflow.bind(this);
  private handleScrollBound = this.handleScroll.bind(this);

  constructor(
    private cityService: CityService,
    private elementRef: ElementRef<HTMLElement>,
    private renderer: Renderer2,
  ) {}

  ngOnInit(): void {
    this.cityService.getCities().subscribe((cities) => {
      this.cities = cities;
      this.citiesLoaded = true;
      this.resolveDisplayText();
      this.onValidatorChange();
    });
    document.addEventListener('click', this.handleClickOutsideBound, true);
    window.addEventListener('resize', this.handleReflowBound);
    document.addEventListener('scroll', this.handleScrollBound, true);
  }

  ngAfterViewInit(): void {
    this.renderer.appendChild(document.body, this.menuRef.nativeElement);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.handleClickOutsideBound, true);
    window.removeEventListener('resize', this.handleReflowBound);
    document.removeEventListener('scroll', this.handleScrollBound, true);
    this.menuRef?.nativeElement?.remove();
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

  private isInsideComponent(target: Node): boolean {
    if (this.elementRef.nativeElement.contains(target)) {
      return true;
    }
    return this.menuRef?.nativeElement?.contains(target) ?? false;
  }

  private handleClickOutside(event: Event): void {
    if (this.showSuggestions && !this.isInsideComponent(event.target as Node)) {
      this.showSuggestions = false;
    }
  }

  private handleReflow(): void {
    if (this.showSuggestions) {
      this.updateMenuPosition();
    }
  }

  private handleScroll(event: Event): void {
    if (!this.showSuggestions) {
      return;
    }
    const target = event.target as Node;
    if (this.isInsideComponent(target)) {
      return;
    }
    this.showSuggestions = false;
  }

  private updateMenuPosition(): void {
    const inputEl = this.inputRef?.nativeElement;
    if (!inputEl) {
      return;
    }
    const rect = inputEl.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < CityAutocompleteComponent.MENU_MAX_HEIGHT && spaceAbove > spaceBelow) {
      this.menuPlacement = 'above';
      this.menuBottom = viewportHeight - rect.top + CityAutocompleteComponent.MENU_GAP;
    } else {
      this.menuPlacement = 'below';
      this.menuTop = rect.bottom + CityAutocompleteComponent.MENU_GAP;
    }
    this.menuLeft = rect.left;
    this.menuWidth = rect.width;
  }

  onInput(text: string): void {
    this.value = text;
    this.showSuggestions = true;
    this.updateMenuPosition();
    requestAnimationFrame(() => this.updateMenuPosition());

    const match = this.cities.find((city) => city.name === text.trim());
    this.selectedCityId = match ? match.id : null;

    this.onChange(this.selectedCityId);
    this.onValidatorChange();
  }

  onFocus(): void {
    this.showSuggestions = true;
    this.updateMenuPosition();
    requestAnimationFrame(() => this.updateMenuPosition());
  }

  onBlur(): void {
    this.onTouched();
  }

  selectCity(city: City): void {
    this.value = city.name;
    this.selectedCityId = city.id;
    this.showSuggestions = false;
    this.onChange(this.selectedCityId);
    this.onTouched();
    this.onValidatorChange();
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

  registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  validate(control: AbstractControl): ValidationErrors | null {
    if (!this.value.trim()) {
      return null;
    }
    if (!this.citiesLoaded) {
      return null;
    }
    return this.selectedCityId != null ? null : { cityNotFound: true };
  }
}
