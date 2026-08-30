import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Group } from '../interfaces/group.model';
import { GroupService } from '../../services/group.service';
import { NgIf } from '@angular/common';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';
import { ToastService } from '../../services/toast.service';
import { Subscription } from 'rxjs';
import { DropdownCoordinatorService } from '../../services/dropdown-coordinator.service';

@Component({
  selector: 'app-edit-group-modal',
  imports: [NgIf, ReactiveFormsModule, TranslatePipe],
  templateUrl: './edit-group-modal.component.html',
  styleUrl: './edit-group-modal.component.scss'
})
export class EditGroupModalComponent implements OnInit, OnDestroy {
  @Input() group!: Group;
  @Output() close = new EventEmitter<void>();
  @Output() groupUpdated = new EventEmitter<Group>();
  @Output() groupDeleted = new EventEmitter<number>();

  @ViewChild('groupActionsMenu') groupActionsMenuRef?: ElementRef<HTMLElement>;

  editGroupForm: FormGroup;
  selectedImage: File | null = null;
  previewUrl: string | null = null;
  isSubmitting: boolean = false;
  showActionsMenu = false;

  private coordinatorSubscription: Subscription;
  private originalGroup: { name: string; city: string; sportCategory: string; description: string; imageUrl: string | null } | null = null;

  constructor(
    private groupService: GroupService,
    private fb: FormBuilder,
    private confirmDialogService: ConfirmDialogService,
    private languageService: LanguageService,
    private toastService: ToastService,
    private dropdownCoordinator: DropdownCoordinatorService,
  ) {
    this.editGroupForm = this.fb.group({
      name: ['', Validators.required],
      city: ['', Validators.required],
      sportCategory: ['', Validators.required],
      description: ['']
    });

    this.coordinatorSubscription = this.dropdownCoordinator.activeChanged$.subscribe((activeId) => {
      if (activeId !== this && this.showActionsMenu) {
        this.showActionsMenu = false;
      }
    });
  }

  ngOnInit(): void {
    this.editGroupForm.patchValue({
      name: this.group.name,
      city: this.group.city,
      sportCategory: this.group.sportCategory,
      description: this.group.description
    });

    if (this.group.imageUrl && this.group.imageUrl !== 'default-group.png') {
      this.previewUrl = this.group.imageUrl;
    }

    this.originalGroup = {
      name: (this.group.name ?? '').trim(),
      city: (this.group.city ?? '').trim(),
      sportCategory: (this.group.sportCategory ?? '').trim(),
      description: (this.group.description ?? '').trim(),
      imageUrl: this.previewUrl,
    };
  }

  get hasUnsavedChanges(): boolean {
    if (!this.originalGroup) {
      return false;
    }

    if (this.selectedImage) {
      return true;
    }

    const value = this.editGroupForm.value;
    return (
      (value.name ?? '').trim() !== this.originalGroup.name ||
      (value.city ?? '').trim() !== this.originalGroup.city ||
      (value.sportCategory ?? '').trim() !== this.originalGroup.sportCategory ||
      (value.description ?? '').trim() !== this.originalGroup.description ||
      this.previewUrl !== this.originalGroup.imageUrl
    );
  }

  ngOnDestroy(): void {
    this.coordinatorSubscription.unsubscribe();
    this.dropdownCoordinator.close(this);
  }

  get canDeleteGroup(): boolean {
    return !!this.group;
  }

  onModalContentClick(event: Event): void {
    event.stopPropagation();
  }

  toggleActionsMenu(event: Event): void {
    event.stopPropagation();

    if (this.showActionsMenu) {
      this.closeActionsMenu();
      return;
    }

    if (this.groupActionsMenuRef) {
      this.dropdownCoordinator.open(this, this.groupActionsMenuRef.nativeElement);
    }

    this.showActionsMenu = true;
  }

  private closeActionsMenu(): void {
    this.showActionsMenu = false;
    this.dropdownCoordinator.close(this);
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedImage = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(): void {
    this.selectedImage = null;
    this.previewUrl = null;
  }

  async deleteGroup(event?: Event): Promise<void> {
    event?.stopPropagation();
    this.closeActionsMenu();

    if (!this.canDeleteGroup || this.isSubmitting) {
      return;
    }

    const confirmed = await this.confirmDialogService.confirm('confirmDeleteGroup', {
      previewName: this.group.name,
      previewImageUrl: this.previewUrl || this.group.imageUrl,
    });

    if (!confirmed) {
      return;
    }

    this.isSubmitting = true;

    this.groupService.deleteGroup(this.group.id).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.toastService.showSuccess(
          this.languageService.translate('groupDeleted'),
        );
        this.groupDeleted.emit(this.group.id);
        this.close.emit();
      },
      error: (error) => {
        this.isSubmitting = false;
        this.toastService.showError(this.languageService.translate('deleteGroupError'));
        console.error('Error deleting group:', error);
      },
    });
  }
  
  submitGroup(): void {
    if (this.editGroupForm.invalid) {
      return;
    }
    this.isSubmitting = true;

    const data = {
      Name: this.editGroupForm.value.name,
      Description: this.editGroupForm.value.description,
      City: this.editGroupForm.value.city,
      SportCategory: this.editGroupForm.value.sportCategory,
      GroupPictureUrl: this.previewUrl ? this.previewUrl : ""
    };

    console.log('Update payload:', data);

    this.groupService.updateGroup(this.group.id, data).subscribe(
      (response) => {
        this.isSubmitting = false;
        this.toastService.showSuccess(
          this.languageService.translate('groupUpdatedSuccessfully'),
        );
        this.selectedImage = null;
        const value = this.editGroupForm.value;
        this.originalGroup = {
          name: (value.name ?? '').trim(),
          city: (value.city ?? '').trim(),
          sportCategory: (value.sportCategory ?? '').trim(),
          description: (value.description ?? '').trim(),
          imageUrl: this.previewUrl,
        };
        this.groupUpdated.emit(response);
      },
      (error) => {
        this.isSubmitting = false;
        this.toastService.showError(this.languageService.translate('updateGroupError'));
        console.error('Error updating group:', error);
      }
    );
  }
  
  async onClose(): Promise<void> {
    this.closeActionsMenu();
    if (this.hasUnsavedChanges) {
      if (!(await this.confirmDialogService.confirm('unsavedChangesConfirm'))) {
        return;
      }
    }
    this.close.emit();
  }
}
