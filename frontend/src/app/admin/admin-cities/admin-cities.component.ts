import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { Observable } from 'rxjs';
import { NgFor, NgIf } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { City } from '../../interfaces/city';
import { AdminCityService, CreateCityDto } from '../../../services/admin/admin-city.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { SkeletonTableRowComponent } from '../../skeleton/skeleton-table-row/skeleton-table-row.component';
import { LoadErrorStateComponent } from '../../load-error-state/load-error-state.component';
import { PaginationComponent } from '../../pagination/pagination.component';
import { CanComponentDeactivate } from '../../guards/can-component-deactivate';

type AdminCityMode = 'list' | 'create';

@Component({
  selector: 'app-admin-cities',
  standalone: true,
  imports: [NgFor, NgIf, ReactiveFormsModule, RouterModule, SkeletonTableRowComponent, LoadErrorStateComponent, PaginationComponent],
  templateUrl: './admin-cities.component.html',
  styleUrl: './admin-cities.component.scss',
})
export class AdminCitiesComponent implements OnInit, OnDestroy, CanComponentDeactivate {
  @ViewChild('citiesState') citiesState!: LoadErrorStateComponent;

  mode: AdminCityMode = 'list';

  cities: City[] = [];
  pagedCities: City[] = [];
  isLoading = false;
  pendingCityIds = new Set<number>();

  cityForm: FormGroup;
  isSaving = false;
  formError = '';

  private beforeUnloadHandlerBound = this.beforeUnloadHandler.bind(this);
  private originalCity: { name: string; canton: string } | null = null;

  itemsPerPage = 10;
  resetPageSignal = 0;

  constructor(
    private adminCityService: AdminCityService,
    private toastService: ToastService,
    private confirmDialogService: ConfirmDialogService,
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
  ) {
    this.cityForm = this.buildForm();
  }

  ngOnInit(): void {
    const isNew = this.route.snapshot.url.some((segment) => segment.path === 'new');

    if (isNew) {
      this.mode = 'create';
      this.originalCity = this.snapshotFormValue();
    } else {
      this.mode = 'list';
      this.originalCity = null;
    }
    window.addEventListener('beforeunload', this.beforeUnloadHandlerBound);
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.beforeUnloadHandlerBound);
  }

  private snapshotFormValue(): { name: string; canton: string } {
    const value = this.cityForm.value;
    return {
      name: (value.name ?? '').trim(),
      canton: (value.canton ?? '').trim(),
    };
  }

  get hasUnsavedChanges(): boolean {
    if (!this.originalCity) {
      return false;
    }

    const value = this.cityForm.value;
    return (
      (value.name ?? '').trim() !== this.originalCity.name ||
      (value.canton ?? '').trim() !== this.originalCity.canton
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
      canton: ['', Validators.required],
    });
  }

  loadCities = () => {
    this.isLoading = true;

    return this.adminCityService.getAllCities().pipe(
      tap((cities) => {
        this.cities = cities;
        this.isLoading = false;
        this.resetPageSignal++;
      }),
      catchError((error) => {
        console.error('Error loading cities:', error);
        this.isLoading = false;
        return throwError(() => error);
      }),
    );
  }

  onPagedCitiesChange(pagedCities: City[]): void {
    this.pagedCities = pagedCities;
  }

  isPending(city: City): boolean {
    return this.pendingCityIds.has(city.id);
  }

  async deleteCity(city: City): Promise<void> {
    if (!(await this.confirmDialogService.confirm('confirmDeleteCity'))) {
      return;
    }

    this.pendingCityIds.add(city.id);
    this.adminCityService.deleteCity(city.id).subscribe({
      next: () => {
        this.pendingCityIds.delete(city.id);
        this.toastService.showSuccess('City deleted.');
        this.citiesState.reload();
      },
      error: (error) => {
        console.error('Error deleting city:', error);
        this.pendingCityIds.delete(city.id);
        const fallback = 'Failed to delete city. It may be in use by an arena, group, or user.';
        const message = error?.error?.message || error?.error;
        this.toastService.showError(typeof message === 'string' && message.trim() ? message : fallback);
      },
    });
  }

  submitForm(): void {
    if (this.cityForm.invalid) {
      return;
    }

    this.formError = '';
    this.isSaving = true;
    const value = this.cityForm.value;
    const dto: CreateCityDto = {
      name: value.name,
      canton: value.canton,
    };

    this.adminCityService.createCity(dto).subscribe({
      next: () => {
        this.isSaving = false;
        this.toastService.showSuccess('City created.');
        this.originalCity = this.snapshotFormValue();
        this.router.navigate(['/admin/cities']);
      },
      error: (error) => {
        console.error('Error creating city:', error);
        this.isSaving = false;
        this.toastService.showError('Failed to create city.');
      },
    });
  }

  cancelForm(): void {
    this.router.navigate(['/admin/cities']);
  }
}
