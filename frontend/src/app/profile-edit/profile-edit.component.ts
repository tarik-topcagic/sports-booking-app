import { Component, OnDestroy, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Observable, Subscription, take } from 'rxjs';
import { UserService } from '../../services/user.service';
import { AuthService } from '../../services/auth.service';
import { CommonModule, NgIf } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CanComponentDeactivate } from '../guards/can-component-deactivate';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { LanguageService } from '../../services/language.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { ToastService } from '../../services/toast.service';
import { SkeletonComponent } from '../skeleton/skeleton/skeleton.component';
import { CityAutocompleteComponent } from '../city-autocomplete/city-autocomplete.component';

@Component({
  selector: 'app-profile-edit',
  imports: [
    ReactiveFormsModule,
    CommonModule,
    NgIf,
    TranslatePipe,
    SkeletonComponent,
    CityAutocompleteComponent,
  ],
  templateUrl: './profile-edit.component.html',
  styleUrl: './profile-edit.component.scss',
})
export class ProfileEditComponent
  implements OnInit, OnDestroy, CanComponentDeactivate
{
  editForm!: FormGroup;
  selectedFile: File | null = null;
  previewUrl: string | ArrayBuffer | null = null;
  fileError: string | null = null;
  timestamp = Date.now();
  successMessage = '';
  isLoading = true;
  isSaving = false;

  private beforeUnloadHandlerBound = this.beforeUnloadHandler.bind(this);
  private profileLoadSubscription?: Subscription;
  private originalProfile: { fullName: string; phoneNumber: string; cityId: number | null; profilePictureUrl: string | null } | null = null;

  isCompletionFlow = false;

  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private confirmDialogService: ConfirmDialogService,
    private languageService: LanguageService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.timestamp = Date.now();
    this.isCompletionFlow = this.route.snapshot.queryParamMap.get('onboarding') === 'true';
    
    if (this.isCompletionFlow) {
      document.body.classList.add('onboarding-profile-edit-page');
    }
    this.editForm = this.fb.group({
      fullName: ['', [Validators.required]],
      phoneNumber: [
        '',
        [Validators.required, Validators.pattern(/^\+387[0-9]{8,9}$/)],
      ],
      cityId: [null, Validators.required],
      profilePictureUrl: [''],
    });

    this.profileLoadSubscription = this.userService.getMyProfile().pipe(take(1)).subscribe({
      next: (profile) => {
        this.isLoading = false;
        this.editForm.patchValue({
          fullName: profile.fullName,
          phoneNumber: profile.phoneNumber,
          cityId: profile.cityId,
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

        this.originalProfile = {
          fullName: (profile.fullName ?? '').trim(),
          phoneNumber: (profile.phoneNumber ?? '').trim(),
          cityId: profile.cityId ?? null,
          profilePictureUrl: this.normalizePictureUrl(profile.profilePictureUrl),
        };
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error loading profile for editing:', error);
      },
    });

    window.addEventListener('beforeunload', this.beforeUnloadHandlerBound);
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.beforeUnloadHandlerBound);
    this.profileLoadSubscription?.unsubscribe();
    document.body.classList.remove('onboarding-profile-edit-page');
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

  private normalizePictureUrl(url: string | null | undefined): string | null {
    if (!url || url.trim().toLowerCase() === 'default-profile.png') {
      return null;
    }
    return url;
  }

  get hasUnsavedChanges(): boolean {
    if (!this.originalProfile) {
      return false;
    }

    const value = this.editForm.value;
    const pictureChanged = this.selectedFile
      ? true
      : this.normalizePictureUrl(value.profilePictureUrl) !== this.originalProfile.profilePictureUrl;

    return (
      (value.fullName ?? '').trim() !== this.originalProfile.fullName ||
      (value.phoneNumber ?? '').trim() !== this.originalProfile.phoneNumber ||
      (value.cityId ?? null) !== this.originalProfile.cityId ||
      pictureChanged
    );
  }

  private updateProfile(): void {
    const payload = {
      fullName: this.editForm.value.fullName,
      phoneNumber: this.editForm.value.phoneNumber,
      profilePictureUrl: this.editForm.value.profilePictureUrl,
      cityId: this.editForm.value.cityId,
    };

    this.userService.updateProfile(payload).subscribe({
      next: () => {
        this.isSaving = false;
        this.userService.refreshProfile();
        this.toastService.showSuccess(
          this.languageService.translate('profileUpdated'),
        );
        this.selectedFile = null;
        const value = this.editForm.value;
        this.originalProfile = {
          fullName: (value.fullName ?? '').trim(),
          phoneNumber: (value.phoneNumber ?? '').trim(),
          cityId: value.cityId ?? null,
          profilePictureUrl: this.normalizePictureUrl(value.profilePictureUrl),
        };
        setTimeout(() => {
          this.router.navigate([this.isCompletionFlow ? '/home' : '/profile']);
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
    this.selectedFile = null;
    this.previewUrl = null;
    this.editForm.get('profilePictureUrl')?.setValue(null);

    const fileInput = document.getElementById(
      'profilePicture',
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  beforeUnloadHandler(event: BeforeUnloadEvent) {
    if (this.hasUnsavedChanges) {
      event.returnValue = this.languageService.translate('unsavedChangesConfirm');
    }
  }

  canDeactivate(): boolean | Observable<boolean> | Promise<boolean> {
    if (this.hasUnsavedChanges) {
      return this.confirmDialogService.confirm('unsavedChangesConfirm');
    }
    return true;
  }

  logout(): void {
    this.router.navigate(['']).then((navigated) => {
      if (navigated) {
        this.authService.logout();
      }
    });
  }
}
