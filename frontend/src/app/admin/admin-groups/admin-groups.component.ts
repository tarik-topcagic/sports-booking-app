import { Component, ViewChild } from '@angular/core';
import { catchError, tap, throwError } from 'rxjs';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../navbar/navbar.component';
import { Group, GroupDetails, GroupMember, UpdateGroupDto } from '../../interfaces/group.model';
import { AdminGroupService } from '../../../services/admin/admin-group.service';
import { GroupService } from '../../../services/group.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { SkeletonTableRowComponent } from '../../skeleton/skeleton-table-row/skeleton-table-row.component';
import { SkeletonListItemComponent } from '../../skeleton/skeleton-list-item/skeleton-list-item.component';
import { LoadErrorStateComponent } from '../../load-error-state/load-error-state.component';
import { PaginationComponent } from '../../pagination/pagination.component';

@Component({
  selector: 'app-admin-groups',
  standalone: true,
  imports: [NgFor, NgIf, FormsModule, DatePipe, NavbarComponent, SkeletonTableRowComponent, SkeletonListItemComponent, LoadErrorStateComponent, PaginationComponent],
  templateUrl: './admin-groups.component.html',
  styleUrl: './admin-groups.component.scss',
})
export class AdminGroupsComponent {
  @ViewChild('groupsState') groupsState!: LoadErrorStateComponent;

  groups: Group[] = [];
  pagedGroups: Group[] = [];
  isLoading = false;
  pendingGroupIds = new Set<number>();

  editingGroup: Group | null = null;
  editForm: UpdateGroupDto = { name: '', description: '', city: '', sportCategory: '', groupPictureUrl: '' };
  isSavingEdit = false;

  membersGroup: GroupDetails | null = null;
  isLoadingMembers = false;
  removingMemberIds = new Set<string>();

  filterName = '';
  filterOwner = '';

  itemsPerPage = 10;
  resetPageSignal = 0;

  constructor(
    private adminGroupService: AdminGroupService,
    private groupService: GroupService,
    private toastService: ToastService,
    private confirmDialogService: ConfirmDialogService,
  ) {}

  loadGroups = () => {
    this.isLoading = true;

    return this.adminGroupService.getAllGroups({
      name: this.filterName || undefined,
      owner: this.filterOwner || undefined,
    }).pipe(
      tap((groups) => {
        this.groups = groups;
        this.isLoading = false;
        this.resetPageSignal++;
      }),
      catchError((error) => {
        console.error('Error loading groups:', error);
        this.isLoading = false;
        return throwError(() => error);
      }),
    );
  }

  applyFilters(): void {
    this.groupsState.reload();
  }

  clearFilters(): void {
    this.filterName = '';
    this.filterOwner = '';
    this.groupsState.reload();
  }

  onPagedGroupsChange(pagedGroups: Group[]): void {
    this.pagedGroups = pagedGroups;
  }

  isPending(group: Group): boolean {
    return this.pendingGroupIds.has(group.id);
  }

  async deleteGroup(group: Group): Promise<void> {
    if (!(await this.confirmDialogService.confirm('confirmDeleteGroup'))) {
      return;
    }

    this.pendingGroupIds.add(group.id);
    this.adminGroupService.deleteGroup(group.id).subscribe({
      next: () => {
        this.pendingGroupIds.delete(group.id);
        this.toastService.showSuccess('Group deleted.');
        this.groupsState.reload();
      },
      error: (error) => {
        console.error('Error deleting group:', error);
        this.pendingGroupIds.delete(group.id);
        this.toastService.showError('Failed to delete group.');
      },
    });
  }

  openEdit(group: Group): void {
    this.editingGroup = group;
    this.editForm = {
      name: group.name,
      description: group.description,
      city: group.city,
      sportCategory: group.sportCategory,
      groupPictureUrl: group.imageUrl,
    };
  }

  closeEdit(): void {
    this.editingGroup = null;
    this.isSavingEdit = false;
  }

  saveEdit(): void {
    if (!this.editingGroup) {
      return;
    }

    this.isSavingEdit = true;
    this.adminGroupService.updateGroup(this.editingGroup.id, this.editForm).subscribe({
      next: () => {
        this.toastService.showSuccess('Group updated.');
        this.closeEdit();
        this.groupsState.reload();
      },
      error: (error) => {
        console.error('Error updating group:', error);
        this.isSavingEdit = false;
        this.toastService.showError('Failed to update group.');
      },
    });
  }

  openMembers(group: Group): void {
    this.isLoadingMembers = true;
    this.membersGroup = null;

    this.groupService.getGroupDetails(group.id).subscribe({
      next: (details) => {
        this.membersGroup = details;
        this.isLoadingMembers = false;
      },
      error: (error) => {
        console.error('Error loading group members:', error);
        this.isLoadingMembers = false;
        this.toastService.showError('Failed to load group members.');
      },
    });
  }

  closeMembers(): void {
    this.membersGroup = null;
    this.removingMemberIds.clear();
  }

  isRemovingMember(member: GroupMember): boolean {
    return this.removingMemberIds.has(member.userId);
  }

  async removeMember(member: GroupMember): Promise<void> {
    if (!this.membersGroup) {
      return;
    }

    if (!(await this.confirmDialogService.confirm('confirmRemoveMember'))) {
      return;
    }

    const groupId = this.membersGroup.id;
    this.removingMemberIds.add(member.userId);

    this.adminGroupService.removeMember(groupId, member.userId).subscribe({
      next: () => {
        this.removingMemberIds.delete(member.userId);
        if (this.membersGroup) {
          this.membersGroup = {
            ...this.membersGroup,
            members: this.membersGroup.members.filter((m) => m.userId !== member.userId),
          };
        }
        this.toastService.showSuccess('Member removed.');
        this.groupsState.reload();
      },
      error: (error) => {
        console.error('Error removing member:', error);
        this.removingMemberIds.delete(member.userId);
        this.toastService.showError('Failed to remove member.');
      },
    });
  }
}
