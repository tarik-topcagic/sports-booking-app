import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, HostListener, OnInit, ViewChild } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  getArenaDescriptionTranslationKey,
  getArenaDisplayImage,
} from '../helpers/arena-ui.helper';
import { paginate } from '../helpers/pagination.helper';
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

@Component({
  selector: 'app-sports-arenas',
  imports: [NgIf, NgFor, NgClass, FormsModule, NavbarComponent, TranslatePipe, SkeletonListItemComponent, LoadErrorStateComponent, PaginationComponent],
  templateUrl: './sports-arenas.component.html',
  styleUrl: './sports-arenas.component.scss',
})
export class SportsArenasComponent implements OnInit {
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

  arenas: Arena[] = [];
  filteredArenas: Arena[] = [];
  pagedArenas: Arena[] = [];

  favoriteArenas: FavoriteArena[] = [];
  removingFavoriteArenaId: number | null = null;

  currentPage = 1;
  pageSize = 6;
  totalPages = 0;
  totalPagesArray: number[] = [];

  constructor(
    private arenaService: ArenaService,
    private favoriteArenaService: FavoriteArenaService,
    private languageService: LanguageService,
    private toastService: ToastService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadFavoriteArenas();
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

  toggleCityMenu(event?: Event): void {
    event?.stopPropagation();
    this.showCityMenu = !this.showCityMenu;
    this.showSportMenu = false;
  }

  toggleSportMenu(event?: Event): void {
    event?.stopPropagation();
    this.showSportMenu = !this.showSportMenu;
    this.showCityMenu = false;
  }

  selectCityFilter(city: string, event?: Event): void {
    event?.stopPropagation();
    this.activeCityFilter = city;
    this.showCityMenu = false;
    this.arenasState.reload();
  }

  selectSportFilter(sportType: string, event?: Event): void {
    event?.stopPropagation();
    this.activeSportFilter = sportType;
    this.showSportMenu = false;
    this.arenasState.reload();
  }

  clearCityFilter(event?: Event): void {
    event?.stopPropagation();
    this.activeCityFilter = '';
    this.showCityMenu = false;
    this.arenasState.reload();
  }

  clearSportFilter(event?: Event): void {
    event?.stopPropagation();
    this.activeSportFilter = '';
    this.showSportMenu = false;
    this.arenasState.reload();
  }

  viewDetails(arena: Arena): void {
    this.router.navigate(['/sports-arenas', arena.id]);
  }

  setupPagination(): void {
    this.currentPage = 1;
    this.setPagedArenas();
  }

  setPagedArenas(): void {
    const pagination = paginate(this.filteredArenas, this.currentPage, this.pageSize);
    this.pagedArenas = pagination.pagedItems;
    this.totalPages = pagination.totalPages;
    this.totalPagesArray = pagination.totalPagesArray;
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.setPagedArenas();
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

  @HostListener('document:click')
  closeMenus(): void {
    this.showCityMenu = false;
    this.showSportMenu = false;
  }

  private applyFiltersAndSort(): void {
    this.filteredArenas = sortItemsByText(this.arenas, (arena) => arena.name, this.activeSort);
    this.setupPagination();
  }
}