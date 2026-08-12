import { Component, OnInit } from '@angular/core';
import { DatePipe, NgFor, NgIf } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavbarComponent } from '../../navbar/navbar.component';
import { Group, GroupDetails, GroupMember, UpdateGroupDto } from '../../interfaces/group.model';
import { AdminGroupService } from '../../../services/admin/admin-group.service';
import { GroupService } from '../../../services/group.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmDialogService } from '../../../services/confirm-dialog.service';
import { paginate } from '../../helpers/pagination.helper';
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
export class AdminGroupsComponent implements OnInit {
  groups: Group[] = [];
  pagedGroups: Group[] = [];
  isLoading = false;
  errorMessage = '';
  pendingGroupIds = new Set<number>();

  editingGroup: Group | null = null;
  editForm: UpdateGroupDto = { name: '', description: '', grad: '', kategorijaSporta: '', groupPictureUrl: '' };
  isSavingEdit = false;

  membersGroup: GroupDetails | null = null;
  isLoadingMembers = false;
  removingMemberIds = new Set<string>();

  filterName = '';
  filterOwner = '';

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 0;
  totalPagesArray: number[] = [];

  constructor(
    private adminGroupService: AdminGroupService,
    private groupService: GroupService,
    private toastService: ToastService,
    private confirmDialogService: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    this.loadGroups();
  }

  loadGroups(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.adminGroupService.getAllGroups({
      name: this.filterName || undefined,
      owner: this.filterOwner || undefined,
    }).subscribe({
      next: (groups) => {
        this.groups = groups;
        this.isLoading = false;
        this.currentPage = 1;
        this.setupPagination();
      },
      error: (error) => {
        console.error('Error loading groups:', error);
        this.errorMessage = 'Failed to load groups.';
        this.isLoading = false;
      },
    });
  }

  applyFilters(): void {
    this.loadGroups();
  }

  clearFilters(): void {
    this.filterName = '';
    this.filterOwner = '';
    this.loadGroups();
  }

  private setupPagination(): void {
    const pagination = paginate(this.groups, this.currentPage, this.itemsPerPage);
    this.pagedGroups = pagination.pagedItems;
    this.totalPages = pagination.totalPages;
    this.totalPagesArray = pagination.totalPagesArray;
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.setupPagination();
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
        this.loadGroups();
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
      grad: group.grad,
      kategorijaSporta: group.kategorijaSporta,
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
        this.loadGroups();
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
        this.loadGroups();
      },
      error: (error) => {
        console.error('Error removing member:', error);
        this.removingMemberIds.delete(member.userId);
        this.toastService.showError('Failed to remove member.');
      },
    });
  }
}
