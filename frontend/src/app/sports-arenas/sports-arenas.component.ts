import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { catchError, Subscription, tap, throwError } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  getArenaDescriptionTranslationKey,
  getArenaDisplayImage,
} from '../helpers/arena-ui.helper';
import { SearchSortDirection, sortItemsByText } from '../helpers/search.helper';
import { Arena } from '../interfaces/arena.model';
import { FavoriteArena } from '../interfaces/favorite-arena.model';
import { NavbarComponent } from '../navbar/navbar.component';
import { TranslatePipe } from '../pipes/translate.pipe';
import { SkeletonListItemComponent } from '../skeleton/skeleton-list-item/skeleton-list-item.component';
import { LoadErrorStateComponent } from '../load-error-state/load-error-state.component';
import { PaginationComponent } from '../pagination/pagination.component';
import { ArenaService } from '../../services/arena.service';
import { FavoriteArenaService } from '../../services/favorite-arena.service';
import { LanguageService } from '../../services/language.service';
import { ToastService } from '../../services/toast.service';
import { DropdownCoordinatorService } from '../../services/dropdown-coordinator.service';

@Component({
  selector: 'app-sports-arenas',
  imports: [NgIf, NgFor, NgClass, FormsModule, NavbarComponent, TranslatePipe, SkeletonListItemComponent, LoadErrorStateComponent, PaginationComponent],
  templateUrl: './sports-arenas.component.html',
  styleUrl: './sports-arenas.component.scss',
})
export class SportsArenasComponent implements OnInit, OnDestroy {
  readonly cityOptions = [
    'Sarajevo',
    'Mostar',
    'Tuzla',
    'Banja Luka',
    'Bihać',
    'Zenica',
  ];

  readonly sportOptions = ['Football', 'Basketball', 'Padel'];

  searchQuery = '';
  activeCityFilter = '';
  activeSportFilter = '';
  activeSort: SearchSortDirection = 'asc';
  showCityMenu = false;
  showSportMenu = false;

  @ViewChild('arenasState') arenasState!: LoadErrorStateComponent;
  @ViewChild('cityMenuWrapper') cityMenuWrapperRef!: ElementRef<HTMLElement>;
  @ViewChild('sportMenuWrapper') sportMenuWrapperRef!: ElementRef<HTMLElement>;

  arenas: Arena[] = [];
  filteredArenas: Arena[] = [];
  pagedArenas: Arena[] = [];

  favoriteArenas: FavoriteArena[] = [];
  removingFavoriteArenaId: number | null = null;

  pageSize = 6;
  resetPageSignal = 0;

  private readonly cityMenuId: unknown = {};
  private readonly sportMenuId: unknown = {};
  private coordinatorSubscription?: Subscription;

  constructor(
    private arenaService: ArenaService,
    private favoriteArenaService: FavoriteArenaService,
    private languageService: LanguageService,
    private toastService: ToastService,
    private router: Router,
    private dropdownCoordinator: DropdownCoordinatorService,
  ) {
    this.coordinatorSubscription = this.dropdownCoordinator.activeChanged$.subscribe((activeId) => {
      if (activeId !== this.cityMenuId) {
        this.showCityMenu = false;
      }
      if (activeId !== this.sportMenuId) {
        this.showSportMenu = false;
      }
    });
  }

  ngOnInit(): void {
    this.loadFavoriteArenas();
  }

  ngOnDestroy(): void {
    this.coordinatorSubscription?.unsubscribe();
    this.dropdownCoordinator.close(this.cityMenuId);
    this.dropdownCoordinator.close(this.sportMenuId);
  }

  viewFavoriteDetails(favorite: FavoriteArena): void {
    this.router.navigate(['/sports-arenas', favorite.arenaId]);
  }

  removeFavoriteArena(favorite: FavoriteArena, event: Event): void {
    event.stopPropagation();

    if (this.removingFavoriteArenaId !== null) {
      return;
    }

    this.removingFavoriteArenaId = favorite.arenaId;

    this.favoriteArenaService.removeFavorite(favorite.arenaId).subscribe({
      next: () => {
        this.removingFavoriteArenaId = null;
        this.favoriteArenas = this.favoriteArenas.filter((f) => f.arenaId !== favorite.arenaId);
        this.toastService.showSuccess(this.languageService.translate('removedFromFavorites'));
      },
      error: (error) => {
        this.removingFavoriteArenaId = null;
        console.error('Error removing favorite arena:', error);
        this.toastService.showError(this.languageService.translate('removeFavoriteError'));
      },
    });
  }

  private loadFavoriteArenas(): void {
    this.favoriteArenaService.getMyFavorites().subscribe({
      next: (favorites) => (this.favoriteArenas = favorites),
      error: (error) => console.error('Error loading favorite arenas:', error),
    });
  }

  loadArenas = () => this.arenaService.getArenas({
    city: this.activeCityFilter || undefined,
    sportType: this.activeSportFilter || undefined,
    searchTerm: this.searchQuery || undefined,
  }).pipe(
    tap((arenas) => {
      this.arenas = arenas;
      this.applyFiltersAndSort();
    }),
    catchError((error) => {
      console.error('Error loading arenas:', error);
      this.arenas = [];
      this.filteredArenas = [];
      this.pagedArenas = [];
      return throwError(() => error);
    }),
  );

  searchArenas(): void {
    this.arenasState.reload();
  }

  onSearchQueryChange(): void {
    this.arenasState.reload();
  }

  toggleCityMenu(): void {
    if (this.showCityMenu) {
      this.closeCityMenu();
      return;
    }

    this.dropdownCoordinator.open(this.cityMenuId, this.cityMenuWrapperRef.nativeElement);
    this.showCityMenu = true;
  }

  toggleSportMenu(): void {
    if (this.showSportMenu) {
      this.closeSportMenu();
      return;
    }

    this.dropdownCoordinator.open(this.sportMenuId, this.sportMenuWrapperRef.nativeElement);
    this.showSportMenu = true;
  }

  selectCityFilter(city: string): void {
    this.activeCityFilter = city;
    this.closeCityMenu();
    this.arenasState.reload();
  }

  selectSportFilter(sportType: string): void {
    this.activeSportFilter = sportType;
    this.closeSportMenu();
    this.arenasState.reload();
  }

  clearCityFilter(): void {
    this.activeCityFilter = '';
    this.closeCityMenu();
    this.arenasState.reload();
  }

  clearSportFilter(): void {
    this.activeSportFilter = '';
    this.closeSportMenu();
    this.arenasState.reload();
  }

  private closeCityMenu(): void {
    this.showCityMenu = false;
    this.dropdownCoordinator.close(this.cityMenuId);
  }

  private closeSportMenu(): void {
    this.showSportMenu = false;
    this.dropdownCoordinator.close(this.sportMenuId);
  }

  viewDetails(arena: Arena): void {
    this.router.navigate(['/sports-arenas', arena.id]);
  }

  onPagedArenasChange(pagedArenas: Arena[]): void {
    this.pagedArenas = pagedArenas;
  }

  getCityLabel(): string {
    return this.activeCityFilter || 'allCities';
  }

  getSportLabel(): string {
    return this.activeSportFilter || 'allSports';
  }

  getDescriptionPreview(arena: Arena): string {
    return getArenaDescriptionTranslationKey(arena);
  }

  getArenaImageUrl(arena: Arena): string {
    return getArenaDisplayImage(arena);
  }

  getFavoriteArenaImageUrl(favorite: FavoriteArena): string {
    return getArenaDisplayImage({ id: favorite.arenaId } as Arena);
  }

  private applyFiltersAndSort(): void {
    this.filteredArenas = sortItemsByText(this.arenas, (arena) => arena.name, this.activeSort);
    this.resetPageSignal++;
  }
}