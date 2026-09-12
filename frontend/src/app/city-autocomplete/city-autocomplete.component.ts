import {
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
  forwardRef,
} from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { ConnectedPosition, Overlay, OverlayContainer, OverlayPositionBuilder, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
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
   
    Overlay,
    OverlayContainer,
    OverlayPositionBuilder,
  ],
})
export class CityAutocompleteComponent implements ControlValueAccessor, OnInit, OnDestroy {
  @Input() id = '';
  @ViewChild('inputEl') inputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('menuTemplate') private menuTemplateRef!: TemplateRef<unknown>;

  cities: City[] = [];
  value = '';
  selectedCityId: number | null = null;
  disabled = false;
  citiesLoaded = false;

  get showSuggestions(): boolean {
    return this.overlayRef !== null;
  }

  private static readonly MENU_GAP = 0.65 * 16;
  private static readonly MODAL_PANEL_SELECTOR = '.modal-content, .admin-modal';

  private static readonly PANEL_CLASS = 'city-autocomplete-overlay-panel';
  private static readonly PANEL_CLASS_IN_MODAL = 'city-autocomplete-overlay-in-modal';

  private static readonly CONTAINER_CLASS = 'city-autocomplete-overlay-container';
  private static readonly CONTAINER_CLASS_IN_MODAL = 'city-autocomplete-overlay-container-in-modal';

  private static readonly POSITIONS: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: CityAutocompleteComponent.MENU_GAP },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -CityAutocompleteComponent.MENU_GAP },
  ];

  private onChange: (value: number | null) => void = () => {};
  private onTouched: () => void = () => {};
  private coordinatorSubscription?: Subscription;
  private overlayRef: OverlayRef | null = null;

  private readonly isClickInsideOverlay = (target: Node): boolean =>
    this.overlayRef?.overlayElement.contains(target) ?? false;

  constructor(
    private cityService: CityService,
    private elementRef: ElementRef<HTMLElement>,
    private overlay: Overlay,
    private overlayContainer: OverlayContainer,
    private viewContainerRef: ViewContainerRef,
    private dropdownCoordinator: DropdownCoordinatorService,
  ) {
    this.coordinatorSubscription = this.dropdownCoordinator.activeChanged$.subscribe((activeId) => {
      if (activeId !== this && this.overlayRef) {
        this.closeOverlay();
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
    this.closeOverlay();
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

  private openOverlay(): void {
    if (this.overlayRef) {
      return;
    }

    const inputEl = this.inputRef.nativeElement;
    const isInsideModal = !!inputEl.closest(CityAutocompleteComponent.MODAL_PANEL_SELECTOR);

    const containerEl = this.overlayContainer.getContainerElement();
    containerEl.classList.add(CityAutocompleteComponent.CONTAINER_CLASS);
    containerEl.classList.toggle(CityAutocompleteComponent.CONTAINER_CLASS_IN_MODAL, isInsideModal);

    const panelClass = isInsideModal
      ? [CityAutocompleteComponent.PANEL_CLASS, CityAutocompleteComponent.PANEL_CLASS_IN_MODAL]
      : [CityAutocompleteComponent.PANEL_CLASS];

    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(this.inputRef)
      .withPositions(CityAutocompleteComponent.POSITIONS)
      .withPush(true)
      .withViewportMargin(8);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      width: inputEl.getBoundingClientRect().width,
      panelClass,
    });

    this.overlayRef.attach(new TemplatePortal(this.menuTemplateRef, this.viewContainerRef));
  }

  private closeOverlay(): void {
    if (!this.overlayRef) {
      return;
    }
    this.overlayRef.dispose();
    this.overlayRef = null;
  }

  onInput(text: string): void {
    this.value = text;
    this.openOverlay();
    this.dropdownCoordinator.open(this, this.elementRef.nativeElement, this.isClickInsideOverlay);

    const match = this.cities.find((city) => city.name === text.trim());
    this.selectedCityId = match ? match.id : null;

    this.onChange(this.selectedCityId);
  }

  onFocus(): void {
    this.openOverlay();
    this.dropdownCoordinator.open(this, this.elementRef.nativeElement, this.isClickInsideOverlay);
  }

  onBlur(): void {
    this.onTouched();
  }

  selectCity(city: City): void {
    this.value = city.name;
    this.selectedCityId = city.id;
    this.closeOverlay();
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
