import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { City } from '../interfaces/city';
import { map, Observable, startWith, Subscription } from 'rxjs';
import { UserService } from '../../services/user.service';
import { CityService } from '../../services/city.service';
import { CommonModule, NgFor, NgIf } from '@angular/common';
import { Router } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';
import { CanComponentDeactivate } from '../guards/can-component-deactivate';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { ToastService } from '../../services/toast.service';
import { SkeletonComponent } from '../skeleton/skeleton/skeleton.component';
import { DropdownCoordinatorService } from '../../services/dropdown-coordinator.service';

@Component({
  selector: 'app-profile-edit',
  imports: [
    ReactiveFormsModule,
    CommonModule,
    NgIf,
    NgFor,
    NavbarComponent,
    TranslatePipe,
    SkeletonComponent,
  ],
  templateUrl: './profile-edit.component.html',
  styleUrl: './profile-edit.component.scss',
})
export class ProfileEditComponent
  implements OnInit, OnDestroy, CanComponentDeactivate
{
  @ViewChild('locationFieldWrapper') locationFieldWrapperRef!: ElementRef<HTMLElement>;

  editForm!: FormGroup;
  cities: City[] = [];
  filteredCities$!: Observable<City[]>;
  selectedFile: File | null = null;
  previewUrl: string | ArrayBuffer | null = null;
  fileError: string | null = null;
  showDropdown = false;
  timestamp = Date.now();
  successMessage = '';
  isLoading = true;
  isSaving = false;
  isRemovingPicture = false;

  private beforeUnloadHandlerBound = this.beforeUnloadHandler.bind(this);
  private coordinatorSubscription?: Subscription;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private cityService: CityService,
    private router: Router,
    private confirmDialogService: ConfirmDialogService,
    private languageService: LanguageService,
    private toastService: ToastService,
    private dropdownCoordinator: DropdownCoordinatorService,
  ) {
    this.coordinatorSubscription = this.dropdownCoordinator.activeChanged$.subscribe((activeId) => {
      if (activeId !== this && this.showDropdown) {
        this.showDropdown = false;
      }
    });
  }

  ngOnInit(): void {
    this.timestamp = Date.now();
    this.editForm = this.fb.group({
      fullName: ['', [Validators.required]],
      phoneNumber: [
        '',
        [Validators.required, Validators.pattern(/^\+387[0-9]{8,9}$/)],
      ],
      location: [''],
      profilePictureUrl: [''],
    });

    this.userService.getMyProfile().subscribe({
      next: (profile) => {
        this.isLoading = false;
        this.editForm.patchValue({
          fullName: profile.fullName,
          phoneNumber: profile.phoneNumber,
          location: profile.location || '',
          profilePictureUrl: profile.profilePictureUrl,
        });

        if (
          profile.profilePictureUrl &&
          profile.profilePictureUrl.trim().toLowerCase() !== 'default-profile.png'
        ) {
          this.previewUrl = profile.profilePictureUrl;
        } else {
          this.previewUrl = null;
        }

        this.editForm.markAsPristine();
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error loading profile for editing:', error);
      },
    });

    this.cityService.getCities().subscribe((cities) => {
      this.cities = cities;
      this.filteredCities$ = this.editForm.get('location')!.valueChanges.pipe(
        startWith(''),
        map((value) => this._filterCities(value)),
      );
    });
    window.addEventListener('beforeunload', this.beforeUnloadHandlerBound);
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.beforeUnloadHandlerBound);
    this.coordinatorSubscription?.unsubscribe();
    this.dropdownCoordinator.close(this);
  }

  openLocationDropdown(): void {
    this.dropdownCoordinator.open(this, this.locationFieldWrapperRef.nativeElement);
    this.showDropdown = true;
  }

  private _filterCities(value: string): City[] {
    const filterValue = value.toLowerCase();
    return this.cities.filter((city) =>
      city.name.toLowerCase().includes(filterValue),
    );
  }

  selectCity(city: City): void {
    this.editForm.get('location')?.setValue(city.name);

    this.editForm.get('location')?.markAsDirty();

    this.showDropdown = false;
    this.dropdownCoordinator.close(this);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }
    const file = input.files[0];

    if (!file.type.startsWith('image/')) {
      this.fileError = this.languageService.translate('selectValidImage');
      return;
    }

    this.fileError = null;
    this.selectedFile = file;

    const reader = new FileReader();
    reader.onload = () => {
      this.previewUrl = reader.result;
      this.editForm.markAsDirty();
    };
    reader.readAsDataURL(file);
  }

  onSubmit(): void {
    if (this.editForm.invalid || this.isSaving) {
      return;
    }

    this.isSaving = true;

    if (this.selectedFile) {
      const formData = new FormData();
      formData.append('file', this.selectedFile);
      this.userService.uploadProfilePicture(formData).subscribe({
        next: (res: any) => {
          this.editForm.get('profilePictureUrl')?.setValue(res.imageUrl);
          this.updateProfile();
        },
        error: (err) => {
          this.isSaving = false;
          console.error('Error uploading image', err);
          this.fileError = this.languageService.translate('uploadImageError');
        },
      });
    } else {
      this.updateProfile();
    }
  }

  handleImageError(): void {
    this.previewUrl = null;
    this.editForm.get('profilePictureUrl')?.setValue(null);
  }

  private updateProfile(): void {
    this.userService.updateProfile(this.editForm.value).subscribe({
      next: () => {
        this.isSaving = false;
        this.userService.refreshProfile();
        this.toastService.showSuccess(
          this.languageService.translate('profileUpdated'),
        );
        this.editForm.markAsPristine();
        setTimeout(() => {
          this.router.navigate(['/profile']);
        }, 0);
      },
      error: (err) => {
        this.isSaving = false;
        console.error('Error updating profile', err);
        if (err.error && err.error.errors) {
          console.error('Validation errors:', err.error.errors);
        }
        this.toastService.showError(
          this.languageService.translate('updateProfileError'),
        );
      },
    });
  }

  removeProfilePicture(): void {
    if (this.isRemovingPicture) {
      return;
    }

    this.previewUrl = null;
    this.selectedFile = null;
    this.editForm.get('profilePictureUrl')?.setValue(null);
    this.isRemovingPicture = true;

    const fileInput = document.getElementById(
      'profilePicture',
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }

    this.userService.deleteProfilePicture().subscribe({
      next: () => {
        this.isRemovingPicture = false;
        this.editForm.markAsDirty();
        const fileInput = document.getElementById(
          'profilePicture',
        ) as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      },
      error: (err) => {
        this.isRemovingPicture = false;
        console.error('Error removing image', err);
      },
    });
    this.editForm.markAsDirty();
  }

  beforeUnloadHandler(event: BeforeUnloadEvent) {
    if (this.editForm.dirty) {
      event.returnValue = this.languageService.translate('unsavedChangesConfirm');
    }
  }

  canDeactivate(): boolean | Observable<boolean> | Promise<boolean> {
    if (this.editForm.dirty) {
      return this.confirmDialogService.confirm('unsavedChangesConfirm');
    }
    return true;
  }
}
