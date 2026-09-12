import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  Renderer2,
  ViewChild,
  ViewEncapsulation,
  forwardRef,
} from '@angular/core';
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
  encapsulation: ViewEncapsulation.None,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CityAutocompleteComponent),
      multi: true,
    },
  ],
})
export class CityAutocompleteComponent implements ControlValueAccessor, OnInit, AfterViewInit, OnDestroy {
  @Input() id = '';
  @ViewChild('inputEl') inputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('menuEl') menuRef!: ElementRef<HTMLElement>;

  cities: City[] = [];
  value = '';
  selectedCityId: number | null = null;
  showSuggestions = false;
  disabled = false;
  citiesLoaded = false;

  private static readonly MENU_GAP = 0.65 * 16;
  private static readonly MENU_MAX_HEIGHT = 240;
  private static readonly Z_INDEX_NORMAL = 20;
  private static readonly Z_INDEX_IN_MODAL = 1100;
  private static readonly MODAL_PANEL_SELECTOR = '.modal-content, .admin-modal';

  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};
  private coordinatorSubscription?: Subscription;
  private handleReflowBound = this.handleReflow.bind(this);
  private handleScrollBound = this.handleScroll.bind(this);
  private positionUpdateFrameId: number | null = null;

  constructor(
    private cityService: CityService,
    private elementRef: ElementRef<HTMLElement>,
    private renderer: Renderer2,
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

    window.addEventListener('resize', this.handleReflowBound);
    
    window.visualViewport?.addEventListener('resize', this.handleReflowBound);
    
    document.addEventListener('scroll', this.handleScrollBound, { capture: true, passive: true });
  }

  ngAfterViewInit(): void {
    this.renderer.appendChild(document.body, this.menuRef.nativeElement);
  }

  ngOnDestroy(): void {
    this.coordinatorSubscription?.unsubscribe();
    this.dropdownCoordinator.close(this);
    window.removeEventListener('resize', this.handleReflowBound);
    window.visualViewport?.removeEventListener('resize', this.handleReflowBound);
    document.removeEventListener('scroll', this.handleScrollBound, { capture: true });
    if (this.positionUpdateFrameId !== null) {
      cancelAnimationFrame(this.positionUpdateFrameId);
      this.positionUpdateFrameId = null;
    }
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

  private handleReflow(): void {
    if (this.showSuggestions) {
      this.scheduleMenuPositionUpdate();
    }
  }

  private handleScroll(event: Event): void {
    if (!this.showSuggestions) {
      return;
    }

    const target = event.target;

    if (target === document || target === window || this.isInsideComponent(target as Node)) {
      this.scheduleMenuPositionUpdate();
      return;
    }

    this.showSuggestions = false;
  }

  private scheduleMenuPositionUpdate(): void {
    if (this.positionUpdateFrameId !== null) {
      return;
    }
    this.positionUpdateFrameId = requestAnimationFrame(() => {
      this.positionUpdateFrameId = null;
      this.updateMenuPosition();
    });
  }

  private updateMenuPosition(): void {
    const inputEl = this.inputRef?.nativeElement;
    const menuEl = this.menuRef?.nativeElement;
    if (!inputEl || !menuEl) {
      return;
    }

    const rect = inputEl.getBoundingClientRect();
    const gap = CityAutocompleteComponent.MENU_GAP;
    const viewportHeight = window.innerHeight;

    const spaceBelow = viewportHeight - rect.bottom - gap;
    const spaceAbove = rect.top - gap;
    const placeAbove = spaceBelow < CityAutocompleteComponent.MENU_MAX_HEIGHT && spaceAbove > spaceBelow;

    const left = Math.round(rect.left);
    const width = Math.round(rect.width);
    this.renderer.setStyle(menuEl, 'left', `${left}px`);
    this.renderer.setStyle(menuEl, 'width', `${width}px`);

    if (placeAbove) {
      const bottom = Math.round(viewportHeight - rect.top + gap);
      this.renderer.setStyle(menuEl, 'bottom', `${bottom}px`);
      this.renderer.removeStyle(menuEl, 'top');
    } else {
      const top = Math.round(rect.bottom + gap);
      this.renderer.setStyle(menuEl, 'top', `${top}px`);
      this.renderer.removeStyle(menuEl, 'bottom');
    }
  }

  private applyContextualZIndex(): void {
    const inputEl = this.inputRef?.nativeElement;
    const menuEl = this.menuRef?.nativeElement;
    if (!inputEl || !menuEl) {
      return;
    }

    const isInsideModal = !!inputEl.closest(CityAutocompleteComponent.MODAL_PANEL_SELECTOR);
    const zIndex = isInsideModal ? CityAutocompleteComponent.Z_INDEX_IN_MODAL : CityAutocompleteComponent.Z_INDEX_NORMAL;
    this.renderer.setStyle(menuEl, 'z-index', String(zIndex));
  }

  onInput(text: string): void {
    this.value = text;
    this.showSuggestions = true;
    this.applyContextualZIndex();
    this.updateMenuPosition();
    requestAnimationFrame(() => this.updateMenuPosition());
    this.dropdownCoordinator.open(this, this.elementRef.nativeElement);

    const match = this.cities.find((city) => city.name === text.trim());
    this.selectedCityId = match ? match.id : null;

    this.onChange(this.selectedCityId);
  }

  onFocus(): void {
    this.showSuggestions = true;
    this.applyContextualZIndex();
    this.updateMenuPosition();
    requestAnimationFrame(() => this.updateMenuPosition());
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
