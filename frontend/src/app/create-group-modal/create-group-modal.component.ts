import { Component, EventEmitter, Output } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { GroupService } from '../../services/group.service';
import { NgIf } from '@angular/common';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-create-group-modal',
  imports: [NgIf, ReactiveFormsModule, TranslatePipe],
  templateUrl: './create-group-modal.component.html',
  styleUrl: './create-group-modal.component.scss'
})
export class CreateGroupModalComponent {
  @Output() close = new EventEmitter<void>();
  @Output() groupCreated = new EventEmitter<any>();

  createGroupForm: FormGroup;
  selectedImage: File | null = null;
  previewUrl: string | null = null;
  isSubmitting: boolean = false;

  constructor(
    private groupService: GroupService,
    private fb: FormBuilder,
    private confirmDialogService: ConfirmDialogService,
    private languageService: LanguageService,
    private toastService: ToastService,
  ) {
    this.createGroupForm = this.fb.group({
      name: ['', Validators.required],
      city: ['', Validators.required],
      sportCategory: ['', Validators.required],
      description: ['']
    });
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

  get hasUnsavedChanges(): boolean {
    const value = this.createGroupForm.value;
    return !!(
      (value.name ?? '').trim() ||
      (value.city ?? '').trim() ||
      (value.sportCategory ?? '').trim() ||
      (value.description ?? '').trim() ||
      this.selectedImage
    );
  }

  submitGroup(): void {
    if (this.createGroupForm.invalid) {
      return;
    }
    this.isSubmitting = true;

    const data = {
      Name: this.createGroupForm.value.name,
      Description: this.createGroupForm.value.description,
      City: this.createGroupForm.value.city,
      SportCategory: this.createGroupForm.value.sportCategory,
      ImageUrl: this.previewUrl || ""
    };

    this.groupService.createGroup(data).subscribe(
      (response) => {
        this.isSubmitting = false;
        this.toastService.showSuccess(
          this.languageService.translate('groupCreatedSuccessfully'),
        );
        this.groupCreated.emit(response);
      },
      (error) => {
        this.isSubmitting = false;
        this.toastService.showError(this.languageService.translate('createGroupError'));
        console.error('Error creating group:', error);
      }
    );
  }

  async onClose(): Promise<void> {
    if (this.hasUnsavedChanges) {
      if (!(await this.confirmDialogService.confirm('unsavedChangesConfirm'))) {
        return;
      }
    }
    this.close.emit();
  }
}
