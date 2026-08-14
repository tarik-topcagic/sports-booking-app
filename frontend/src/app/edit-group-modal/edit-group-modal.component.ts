import { Component, EventEmitter, HostListener, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Group } from '../interfaces/group.model';
import { GroupService } from '../../services/group.service';
import { NgIf } from '@angular/common';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-edit-group-modal',
  imports: [NgIf, ReactiveFormsModule, TranslatePipe],
  templateUrl: './edit-group-modal.component.html',
  styleUrl: './edit-group-modal.component.scss'
})
export class EditGroupModalComponent implements OnInit {
  @Input() group!: Group; 
  @Output() close = new EventEmitter<void>();
  @Output() groupUpdated = new EventEmitter<Group>();
  @Output() groupDeleted = new EventEmitter<number>();

  editGroupForm: FormGroup;
  selectedImage: File | null = null;
  previewUrl: string | null = null;
  isSubmitting: boolean = false;
  showActionsMenu = false;

  constructor(
    private groupService: GroupService,
    private fb: FormBuilder,
    private confirmDialogService: ConfirmDialogService,
    private languageService: LanguageService,
    private toastService: ToastService,
  ) {
    this.editGroupForm = this.fb.group({
      name: ['', Validators.required],
      city: ['', Validators.required],
      sportCategory: ['', Validators.required],
      description: ['']
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
  }

  get canDeleteGroup(): boolean {
    return !!this.group;
  }

  @HostListener('document:click')
  closeActionsMenu(): void {
    this.showActionsMenu = false;
  }

  onModalContentClick(event: Event): void {
    event.stopPropagation();

    const target = event.target as HTMLElement | null;
    if (!target?.closest('.group-actions-menu')) {
      this.showActionsMenu = false;
    }
  }

  toggleActionsMenu(event: Event): void {
    event.stopPropagation();
    this.showActionsMenu = !this.showActionsMenu;
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedImage = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.previewUrl = reader.result as string;
        this.editGroupForm.markAsDirty();
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(): void {
    this.selectedImage = null;
    this.previewUrl = null;
    this.editGroupForm.markAsDirty();
  }

  async deleteGroup(event?: Event): Promise<void> {
    event?.stopPropagation();
    this.showActionsMenu = false;

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
    this.showActionsMenu = false;
    if (this.editGroupForm.dirty) {
      if (!(await this.confirmDialogService.confirm('unsavedChangesConfirm'))) {
        return;
      }
    }
    this.close.emit();
  }
}
