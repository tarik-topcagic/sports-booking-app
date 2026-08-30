import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { Observable } from 'rxjs';
import { NgFor, NgIf } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
import { CanComponentDeactivate } from '../../guards/can-component-deactivate';

type AdminArenaMode = 'list' | 'create' | 'edit';

@Component({
  selector: 'app-admin-arenas',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, ReactiveFormsModule, RouterModule, AdminSelectComponent, SkeletonTableRowComponent, LoadErrorStateComponent, PaginationComponent],
  templateUrl: './admin-arenas.component.html',
  styleUrl: './admin-arenas.component.scss',
})
export class AdminArenasComponent implements OnInit, OnDestroy, CanComponentDeactivate {
  @ViewChild('arenasState') arenasState!: LoadErrorStateComponent;

  mode: AdminArenaMode = 'list';

  arenas: AdminArenaDto[] = [];
  pagedArenas: AdminArenaDto[] = [];
  isLoading = false;
  pendingArenaIds = new Set<number>();

  editingArenaId: number | null = null;
  arenaForm: FormGroup;
  isSaving = false;
  formError = '';

  private beforeUnloadHandlerBound = this.beforeUnloadHandler.bind(this);
  private originalArena: { name: string; description: string; city: string; sportType: string; address: string; pricePerHour: number } | null = null;

  selectedFile: File | null = null;
  isUploadingPicture = false;
  currentImageUrl: string | null = null;

  filterName = '';
  filterCity = '';
  filterSportType = '';
  filterOptions: ArenaFilterOptions = { cities: [], sports: [] };

  hasAppliedFilters = false;

  get hasActiveFilterInputs(): boolean {
    return !!(this.filterName || this.filterCity || this.filterSportType);
  }

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
    private fb: FormBuilder,
  ) {
    this.arenaForm = this.buildForm();
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const idParam = params.get('id');
      const isNew = this.route.snapshot.url.some((segment) => segment.path === 'new');

      if (idParam) {
        this.mode = 'edit';
        this.editingArenaId = Number(idParam);
        this.arenaForm = this.buildForm();
        this.originalArena = null; 
        this.loadArenaForEdit(this.editingArenaId);
      } else if (isNew) {
        this.mode = 'create';
        this.editingArenaId = null;
        this.arenaForm = this.buildForm();
        this.originalArena = this.snapshotFormValue();
      } else {
        this.mode = 'list';
        this.originalArena = null;
        this.loadFilterOptions();
      }
    });
    window.addEventListener('beforeunload', this.beforeUnloadHandlerBound);
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.beforeUnloadHandlerBound);
  }

  private snapshotFormValue(): { name: string; description: string; city: string; sportType: string; address: string; pricePerHour: number } {
    const value = this.arenaForm.value;
    return {
      name: (value.name ?? '').trim(),
      description: (value.description ?? '').trim(),
      city: (value.city ?? '').trim(),
      sportType: (value.sportType ?? '').trim(),
      address: (value.address ?? '').trim(),
      pricePerHour: value.pricePerHour ?? 0,
    };
  }

  get hasUnsavedChanges(): boolean {
    if (!this.originalArena) {
      return false;
    }

    const value = this.arenaForm.value;
    return (
      (value.name ?? '').trim() !== this.originalArena.name ||
      (value.description ?? '').trim() !== this.originalArena.description ||
      (value.city ?? '').trim() !== this.originalArena.city ||
      (value.sportType ?? '').trim() !== this.originalArena.sportType ||
      (value.address ?? '').trim() !== this.originalArena.address ||
      (value.pricePerHour ?? 0) !== this.originalArena.pricePerHour
    );
  }

  beforeUnloadHandler(event: BeforeUnloadEvent) {
    if (this.hasUnsavedChanges) {
      event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    }
  }

  canDeactivate(): Observable<boolean> | Promise<boolean> | boolean {
    if (this.hasUnsavedChanges) {
      return this.confirmDialogService.confirm('unsavedChangesConfirm');
    }
    return true;
  }

  private buildForm(): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      description: ['', Validators.required],
      city: ['', Validators.required],
      sportType: ['', Validators.required],
      address: ['', Validators.required],
      pricePerHour: [0, [Validators.required, Validators.min(0)]],
    });
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
    this.hasAppliedFilters = this.hasActiveFilterInputs;

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
        this.arenaForm.patchValue({
          name: arena.name,
          description: arena.description,
          city: arena.city,
          sportType: arena.sportType,
          address: arena.address,
          pricePerHour: arena.pricePerHour,
        });
        this.originalArena = this.snapshotFormValue();
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
    if (this.arenaForm.invalid) {
      return;
    }

    this.formError = '';
    this.isSaving = true;
    const value = this.arenaForm.value;

    if (this.mode === 'create') {
      const dto: CreateArenaDto = {
        name: value.name,
        description: value.description,
        city: value.city,
        sportType: value.sportType,
        address: value.address,
        pricePerHour: value.pricePerHour,
      };
      this.adminArenaService.createArena(dto).subscribe({
        next: (arena) => {
          this.isSaving = false;
          this.toastService.showSuccess('Arena created.');
          this.originalArena = this.snapshotFormValue();
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
      const dto: UpdateArenaDto = {
        name: value.name,
        description: value.description,
        city: value.city,
        sportType: value.sportType,
        address: value.address,
        pricePerHour: value.pricePerHour,
      };
      this.adminArenaService.updateArena(this.editingArenaId, dto).subscribe({
        next: () => {
          this.isSaving = false;
          this.toastService.showSuccess('Arena updated.');
          this.originalArena = this.snapshotFormValue();
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
