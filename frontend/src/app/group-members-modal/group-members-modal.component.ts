import { NgFor, NgIf } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Router } from '@angular/router';
import { GroupDetails, GroupMember } from '../interfaces/group.model';
import { TranslatePipe } from '../pipes/translate.pipe';
import { GroupService } from '../../services/group.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { LanguageService } from '../../services/language.service';

@Component({
  selector: 'app-group-members-modal',
  imports: [NgFor, NgIf, TranslatePipe],
  templateUrl: './group-members-modal.component.html',
  styleUrl: './group-members-modal.component.scss'
})
export class GroupMembersModalComponent {
  @Input() group!: GroupDetails;
  @Output() close = new EventEmitter<void>();
  @Output() memberRemoved = new EventEmitter<string>();
  @Output() error = new EventEmitter<string>();

  removingMemberIds = new Set<string>();

  constructor(
    private router: Router,
    private groupService: GroupService,
    private confirmDialogService: ConfirmDialogService,
    private languageService: LanguageService,
  ) {}

  closeModal(): void {
    this.removingMemberIds.clear();
    this.close.emit();
  }

  viewMemberProfile(member: GroupMember): void {
    if (!member.username) {
      return;
    }

    this.closeModal();
    if (this.isCurrentUser(member)) {
      this.router.navigate(['/profile']);
      return;
    }

    this.router.navigate(['/users', member.username]);
  }

  canRemoveMember(member: GroupMember): boolean {
    return !!this.group?.isAdmin && !member.isAdmin;
  }

  isRemovingMember(member: GroupMember): boolean {
    return this.removingMemberIds.has(member.userId);
  }

  isCurrentUser(member: GroupMember): boolean {
    return !!this.group?.currentUserId && member.userId === this.group.currentUserId;
  }

  openPrivateChat(member: GroupMember): void {
    if (this.isCurrentUser(member)) {
      return;
    }

    this.closeModal();
    this.router.navigate(['/messages/private/user', member.userId]);
  }

  async removeMember(member: GroupMember): Promise<void> {
    if (!this.group || !this.canRemoveMember(member)) {
      return;
    }

    if (!(await this.confirmDialogService.confirm('confirmRemoveMember', {
      previewName: member.displayName || member.username,
      previewImageUrl: member.profilePictureUrl,
    }))) {
      return;
    }

    this.removingMemberIds.add(member.userId);

    this.groupService.removeMember(this.group.id, member.userId).subscribe(
      () => {
        this.removingMemberIds.delete(member.userId);
        this.memberRemoved.emit(member.userId);
        this.closeModal();
      },
      (error) => {
        this.removingMemberIds.delete(member.userId);
        this.error.emit(this.languageService.translate('removeMemberError'));
        console.error('Error removing group member:', error);
      },
    );
  }
}
