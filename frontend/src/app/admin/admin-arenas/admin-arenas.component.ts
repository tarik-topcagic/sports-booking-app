import { Component, OnInit, ViewChild } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { NavbarComponent } from '../../navbar/navbar.component';
import { AdminSelectComponent, AdminSelectOption } from '../../admin-select/admin-select.component';
import { Arena, CreateArenaDto, UpdateArenaDto } from '../../interfaces/arena.model';
import { AdminArenaDto } from '../../interfaces/admin/admin-arena.model';
import { ArenaService } from '../../../services/arena.service';
import { AdminArenaService, ArenaFilterOptions } from '../../../services/admin/admin-arena.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { SkeletonTableRowComponent } from '../../skeleton/skeleton-table-row/skeleton-table-row.component';
import { LoadErrorStateComponent } from '../../load-error-state/load-error-state.component';
import { PaginationComponent } from '../../pagination/pagination.component';

type AdminArenaMode = 'list' | 'create' | 'edit';

@Component({
  selector: 'app-admin-arenas',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, RouterModule, NavbarComponent, AdminSelectComponent, SkeletonTableRowComponent, LoadErrorStateComponent, PaginationComponent],
  templateUrl: './admin-arenas.component.html',
  styleUrl: './admin-arenas.component.scss',
})
export class AdminArenasComponent implements OnInit {
  @ViewChild('arenasState') arenasState!: LoadErrorStateComponent;

  mode: AdminArenaMode = 'list';

  arenas: AdminArenaDto[] = [];
  pagedArenas: AdminArenaDto[] = [];
  isLoading = false;
  pendingArenaIds = new Set<number>();

  editingArenaId: number | null = null;
  form: CreateArenaDto | UpdateArenaDto = this.emptyForm();
  isSaving = false;
  formError = '';

  selectedFile: File | null = null;
  isUploadingPicture = false;
  currentImageUrl: string | null = null;

  filterName = '';
  filterCity = '';
  filterSportType = '';
  filterOptions: ArenaFilterOptions = { cities: [], sports: [] };

  get cityOptions(): AdminSelectOption[] {
    return [{ value: '', label: 'All' }, ...this.filterOptions.cities.map((city) => ({ value: city, label: city }))];
  }

  get sportOptions(): AdminSelectOption[] {
    return [{ value: '', label: 'All' }, ...this.filterOptions.sports.map((sport) => ({ value: sport, label: sport }))];
  }

  itemsPerPage = 10;
  resetPageSignal = 0;

  constructor(
    private arenaService: ArenaService,
    private adminArenaService: AdminArenaService,
    private toastService: ToastService,
    private confirmDialogService: ConfirmDialogService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const idParam = params.get('id');
      const isNew = this.route.snapshot.url.some((segment) => segment.path === 'new');

      if (idParam) {
        this.mode = 'edit';
        this.editingArenaId = Number(idParam);
        this.loadArenaForEdit(this.editingArenaId);
      } else if (isNew) {
        this.mode = 'create';
        this.editingArenaId = null;
        this.form = this.emptyForm();
      } else {
        this.mode = 'list';
        this.loadFilterOptions();
      }
    });
  }

  private emptyForm(): CreateArenaDto {
    return { name: '', description: '', city: '', sportType: '', address: '', pricePerHour: 0 };
  }

  private loadFilterOptions(): void {
    this.adminArenaService.getFilterOptions().subscribe({
      next: (options) => {
        this.filterOptions = options;
      },
      error: (error) => {
        console.error('Error loading arena filter options:', error);
      },
    });
  }

  loadArenas = () => {
    this.isLoading = true;

    return this.adminArenaService.getAllArenas({
      name: this.filterName || undefined,
      city: this.filterCity || undefined,
      sportType: this.filterSportType || undefined,
    }).pipe(
      tap((arenas) => {
        this.arenas = arenas;
        this.isLoading = false;
        this.resetPageSignal++;
      }),
      catchError((error) => {
        console.error('Error loading arenas:', error);
        this.isLoading = false;
        return throwError(() => error);
      }),
    );
  }

  applyFilters(): void {
    this.arenasState.reload();
  }

  clearFilters(): void {
    this.filterName = '';
    this.filterCity = '';
    this.filterSportType = '';
    this.arenasState.reload();
  }

  onPagedArenasChange(pagedArenas: AdminArenaDto[]): void {
    this.pagedArenas = pagedArenas;
  }

  private loadArenaForEdit(id: number): void {
    this.arenaService.getArenaById(id).subscribe({
      next: (arena) => {
        this.form = {
          name: arena.name,
          description: arena.description,
          city: arena.city,
          sportType: arena.sportType,
          address: arena.address,
          pricePerHour: arena.pricePerHour,
        };
        this.currentImageUrl = arena.imageUrl;
      },
      error: (error) => {
        console.error('Error loading arena:', error);
        this.formError = 'Failed to load arena.';
      },
    });
  }

  isPending(arena: Arena): boolean {
    return this.pendingArenaIds.has(arena.id);
  }

  async deleteArena(arena: Arena): Promise<void> {
    if (!(await this.confirmDialogService.confirm('confirmDeleteArena'))) {
      return;
    }

    this.pendingArenaIds.add(arena.id);
    this.adminArenaService.deleteArena(arena.id).subscribe({
      next: () => {
        this.pendingArenaIds.delete(arena.id);
        this.toastService.showSuccess('Arena deleted.');
        this.arenasState.reload();
      },
      error: (error) => {
        console.error('Error deleting arena:', error);
        this.pendingArenaIds.delete(arena.id);
        const fallback = 'Failed to delete arena. It may have existing reservations.';
        const message = error?.error?.message || error?.error;
        this.toastService.showError(this.isDisplayableErrorMessage(message) ? message : fallback);
      },
    });
  }

  submitForm(): void {
    this.formError = '';
    this.isSaving = true;

    if (this.mode === 'create') {
      this.adminArenaService.createArena(this.form as CreateArenaDto).subscribe({
        next: (arena) => {
          this.isSaving = false;
          this.toastService.showSuccess('Arena created.');
          this.router.navigate(['/admin/arenas', arena.id, 'edit']);
        },
        error: (error) => {
          console.error('Error creating arena:', error);
          this.isSaving = false;
          this.toastService.showError('Failed to create arena.');
        },
      });
      return;
    }

    if (this.mode === 'edit' && this.editingArenaId != null) {
      this.adminArenaService.updateArena(this.editingArenaId, this.form as UpdateArenaDto).subscribe({
        next: () => {
          this.isSaving = false;
          this.toastService.showSuccess('Arena updated.');
          this.router.navigate(['/admin/arenas']);
        },
        error: (error) => {
          console.error('Error updating arena:', error);
          this.isSaving = false;
          this.toastService.showError('Failed to update arena.');
        },
      });
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.length ? input.files[0] : null;
  }

  uploadPicture(): void {
    if (!this.selectedFile || this.editingArenaId == null) {
      return;
    }

    this.isUploadingPicture = true;
    this.adminArenaService.uploadArenaPicture(this.editingArenaId, this.selectedFile).subscribe({
      next: (res: any) => {
        this.isUploadingPicture = false;
        this.selectedFile = null;
        this.currentImageUrl = res?.imageUrl ?? this.currentImageUrl;
        this.toastService.showSuccess('Picture uploaded.');
      },
      error: (error) => {
        console.error('Error uploading arena picture:', error);
        this.isUploadingPicture = false;
        this.toastService.showError('Failed to upload picture.');
      },
    });
  }

  cancelForm(): void {
    this.router.navigate(['/admin/arenas']);
  }

  private isDisplayableErrorMessage(message: unknown): message is string {
    if (typeof message !== 'string' || !message.trim()) {
      return false;
    }
    if (message.length > 300) {
      return false;
    }
    if (/<\/?[a-z][\s\S]*>/i.test(message)) {
      return false;
    }
    if (/\bat\s+[\w.]+\(|StackTrace|Exception:/i.test(message)) {
      return false;
    }
    return true;
  }
}
