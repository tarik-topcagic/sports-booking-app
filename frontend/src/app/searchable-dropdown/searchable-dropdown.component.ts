import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  TemplateRef,
  ViewChild,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { ConnectedPosition, Overlay, OverlayContainer, OverlayPositionBuilder, OverlayRef } from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import { Subscription } from 'rxjs';
import { DropdownCoordinatorService } from '../../services/dropdown-coordinator.service';

@Component({
  selector: 'app-searchable-dropdown',
  standalone: true,
  imports: [NgFor, NgIf],
  templateUrl: './searchable-dropdown.component.html',
  styleUrl: './searchable-dropdown.component.scss',
  host: { '[attr.id]': 'null' },
  encapsulation: ViewEncapsulation.None,
  providers: [Overlay, OverlayContainer, OverlayPositionBuilder],
})
export class SearchableDropdownComponent<T> implements OnDestroy {
  @Input() id = '';
  @Input() items: T[] = [];
  @Input() itemsLoaded = true;
  @Input() itemLabel: (item: T) => string = (item) => String(item);
  @Input() matchValue?: (item: T) => string;
  @Input() filterPredicate?: (item: T, query: string) => boolean;
  @Input() placeholder = '';
  @Input() loadingText = 'Loading...';
  @Input() noResultsText = 'No results found.';
  @Input() disabled = false;
  @Output() itemSelected = new EventEmitter<T>();
  @Output() selectionCleared = new EventEmitter<void>();
  @Output() queryChange = new EventEmitter<string>();
  @Output() blurred = new EventEmitter<void>();
  @ViewChild('inputEl') inputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('menuTemplate') private menuTemplateRef!: TemplateRef<unknown>;

  value = '';

  private static readonly MENU_GAP = 0.65 * 16;
  private static readonly MODAL_PANEL_SELECTOR = '.modal-content, .admin-modal';

  private static readonly PANEL_CLASS = 'searchable-dropdown-overlay-panel';
  private static readonly PANEL_CLASS_IN_MODAL = 'searchable-dropdown-overlay-in-modal';

  private static readonly CONTAINER_CLASS = 'searchable-dropdown-overlay-container';
  private static readonly CONTAINER_CLASS_IN_MODAL = 'searchable-dropdown-overlay-container-in-modal';

  private static readonly POSITIONS: ConnectedPosition[] = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: SearchableDropdownComponent.MENU_GAP },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -SearchableDropdownComponent.MENU_GAP },
  ];

  private coordinatorSubscription?: Subscription;
  private overlayRef: OverlayRef | null = null;
  private modalResizeObserver: ResizeObserver | null = null;

  private readonly isClickInsideOverlay = (target: Node): boolean =>
    this.overlayRef?.overlayElement.contains(target) ?? false;

  constructor(
    private elementRef: ElementRef<HTMLElement>,
    private overlay: Overlay,
    private overlayContainer: OverlayContainer,
    private viewContainerRef: ViewContainerRef,
    private dropdownCoordinator: DropdownCoordinatorService,
    private cdr: ChangeDetectorRef,
  ) {
    this.coordinatorSubscription = this.dropdownCoordinator.activeChanged$.subscribe((activeId) => {
      if (activeId !== this && this.overlayRef) {
        this.closeOverlay();
      }
    });
  }

  ngOnDestroy(): void {
    this.coordinatorSubscription?.unsubscribe();
    this.dropdownCoordinator.close(this);
    this.closeOverlay();
  }

  get filteredItems(): T[] {
    const query = this.value.trim().toLowerCase();
    if (!query) {
      return this.items;
    }
    if (this.filterPredicate) {
      return this.items.filter((item) => this.filterPredicate!(item, query));
    }
    return this.items.filter((item) => this.itemLabel(item).toLowerCase().includes(query));
  }

  setDisplayValue(text: string): void {
    this.value = text;
    this.cdr.detectChanges();
  }

  private openOverlay(): void {
    if (this.overlayRef) {
      this.overlayRef.updatePosition();
      return;
    }

    const inputEl = this.inputRef.nativeElement;
    const modalPanel = inputEl.closest<HTMLElement>(SearchableDropdownComponent.MODAL_PANEL_SELECTOR);
    const isInsideModal = !!modalPanel;

    const containerEl = this.overlayContainer.getContainerElement();
    containerEl.classList.add(SearchableDropdownComponent.CONTAINER_CLASS);
    containerEl.classList.toggle(SearchableDropdownComponent.CONTAINER_CLASS_IN_MODAL, isInsideModal);

    const panelClass = isInsideModal
      ? [SearchableDropdownComponent.PANEL_CLASS, SearchableDropdownComponent.PANEL_CLASS_IN_MODAL]
      : [SearchableDropdownComponent.PANEL_CLASS];

    const positionStrategy = this.overlay
      .position()
      .flexibleConnectedTo(this.inputRef)
      .withPositions(SearchableDropdownComponent.POSITIONS)
      .withPush(true)
      .withViewportMargin(8);

    this.overlayRef = this.overlay.create({
      positionStrategy,
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      width: inputEl.getBoundingClientRect().width,
      panelClass,
    });

    this.overlayRef.attach(new TemplatePortal(this.menuTemplateRef, this.viewContainerRef));
    this.overlayRef.updatePosition();

    if (modalPanel) {
      this.modalResizeObserver = new ResizeObserver(() => this.overlayRef?.updatePosition());
      this.modalResizeObserver.observe(modalPanel);
    }
  }

  private closeOverlay(): void {
    this.modalResizeObserver?.disconnect();
    this.modalResizeObserver = null;
    if (!this.overlayRef) {
      return;
    }
    this.overlayRef.dispose();
    this.overlayRef = null;
  }

  private checkForExactMatch(text: string): void {
    const trimmed = text.trim();
    const matchFn = this.matchValue ?? this.itemLabel;
    const match = this.items.find((item) => matchFn(item) === trimmed);
    if (match) {
      this.itemSelected.emit(match);
    } else {
      this.selectionCleared.emit();
    }
  }

  onInput(text: string): void {
    this.value = text;
    this.openOverlay();
    this.dropdownCoordinator.open(this, this.elementRef.nativeElement, this.isClickInsideOverlay);
    this.queryChange.emit(text);
    this.checkForExactMatch(text);
  }

  onFocus(): void {
    this.openOverlay();
    this.dropdownCoordinator.open(this, this.elementRef.nativeElement, this.isClickInsideOverlay);
  }

  onBlur(): void {
    this.blurred.emit();
  }

  selectItem(item: T): void {
    const matchFn = this.matchValue ?? this.itemLabel;
    this.value = matchFn(item);
    this.closeOverlay();
    this.dropdownCoordinator.close(this);
    this.itemSelected.emit(item);
  }
}
