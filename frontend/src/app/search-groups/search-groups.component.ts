import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Group } from '../interfaces/group.model';
import { GroupService } from '../../services/group.service';
import { NavbarComponent } from '../navbar/navbar.component';
import { FormsModule } from '@angular/forms';
import { NgClass, NgFor, NgIf } from '@angular/common';
import { CreateGroupModalComponent } from '../create-group-modal/create-group-modal.component';
import { EditGroupModalComponent } from '../edit-group-modal/edit-group-modal.component';
import { TranslatePipe } from '../pipes/translate.pipe';
import { SkeletonListItemComponent } from '../skeleton/skeleton-list-item/skeleton-list-item.component';
import { LoadErrorStateComponent } from '../load-error-state/load-error-state.component';
import { PaginationComponent } from '../pagination/pagination.component';
import { Router } from '@angular/router';
import { Subscription, catchError, forkJoin, of } from 'rxjs';
import { paginate } from '../helpers/pagination.helper';
import { matchesSearchQuery, SearchSortDirection, sortItemsByText } from '../helpers/search.helper';
import { GroupDetails } from '../interfaces/group.model';
import { LanguageService } from '../../services/language.service';
import { ToastService } from '../../services/toast.service';
import {
  cancelGroupAccessRequest,
  requestGroupAccess,
  respondToGroupInvitation,
} from '../helpers/group-membership-actions.helper';

@Component({
  selector: 'app-search-groups',
  imports: [NgIf, NgFor, NgClass, NavbarComponent, FormsModule, CreateGroupModalComponent, EditGroupModalComponent, TranslatePipe, SkeletonListItemComponent, LoadErrorStateComponent, PaginationComponent],
  templateUrl: './search-groups.component.html',
  styleUrl: './search-groups.component.scss',
})
export class SearchGroupsComponent implements OnInit, OnDestroy {
  searchQuery = '';
  filteredGroups: Group[] = [];
  allGroups: Group[] = [];
  myGroups: Group[] = [];
  memberGroups: Group[] = [];
  activeFilter: 'all' | 'admin' | 'membership' = 'admin';
  activeSort: SearchSortDirection = 'asc';
  showFilterMenu = false;
  showSortMenu = false;
  showCreateGroupModal = false;
  showEditGroupModal = false;
  selectedGroupToEdit: Group | null = null;
  isLoadingGroups = false;
  errorMessage = '';
  pendingJoinRequestGroupIds = new Set<number>();
  pendingInvitationGroupIds = new Set<number>();
  requestingAccessGroupIds = new Set<number>();
  cancelingAccessRequestGroupIds = new Set<number>();
  respondingToInvitationGroupIds = new Set<number>();
  private pendingInvitationMembershipIdByGroupId = new Map<number, number>();

  currentPage = 1;
  pageSize = 6;
  totalPages = 0;
  pagedGroups: Group[] = [];
  totalPagesArray: number[] = [];

  private membershipChangedSubscription?: Subscription;

  constructor(
    private groupService: GroupService,
    private router: Router,
    private languageService: LanguageService,
    private toastService: ToastService,
  ) {
    this.membershipChangedSubscription = this.groupService.membershipChanged$.subscribe(() => {
      this.loadGroupCollections();
    });
  }

  ngOnInit(): void {
    this.loadGroupCollections();
  }

  ngOnDestroy(): void {
    this.membershipChangedSubscription?.unsubscribe();
  }

  searchGroups(): void {
    this.applyFiltersAndSort();
  }

  onSearchQueryChange(): void {
    this.applyFiltersAndSort();
  }

  onFilterChange(): void {
    this.applyFiltersAndSort();
  }

  toggleFilterMenu(event?: Event): void {
    event?.stopPropagation();
    this.showFilterMenu = !this.showFilterMenu;
    this.showSortMenu = false;
  }

  selectFilter(filter: 'all' | 'admin' | 'membership', event?: Event): void {
    event?.stopPropagation();
    this.activeFilter = filter;
    this.showFilterMenu = false;
    this.onFilterChange();
  }

  onSortChange(): void {
    this.applyFiltersAndSort();
  }

  toggleSortMenu(event?: Event): void {
    event?.stopPropagation();
    this.showFilterMenu = false;
    this.showSortMenu = !this.showSortMenu;
  }

  selectSortDirection(direction: SearchSortDirection, event?: Event): void {
    event?.stopPropagation();
    this.activeSort = direction;
    this.showSortMenu = false;
    this.onSortChange();
  }

  @HostListener('document:click')
  closeSortMenu(): void {
    this.showFilterMenu = false;
    this.showSortMenu = false;
  }

  setupPagination(): void {
    this.currentPage = 1;
    this.setPagedGroups();
  }

  setPagedGroups(): void {
    const pagination = paginate(this.filteredGroups, this.currentPage, this.pageSize);
    this.pagedGroups = pagination.pagedItems;
    this.totalPages = pagination.totalPages;
    this.totalPagesArray = pagination.totalPagesArray;
  }

  onPageChange(page: number): void {
    this.currentPage = page;
    this.setPagedGroups();
  }

  getTotalPagesArray(): number[] {
    return this.totalPagesArray;
  }

  openCreateGroupModal(): void {
    this.showCreateGroupModal = true;
  }

  closeCreateGroupModal(): void {
    this.showCreateGroupModal = false;
    this.loadGroupCollections();
  }

  onGroupCreated(newGroup: Group): void {
    this.loadGroupCollections();
    this.closeCreateGroupModal();
  }

  openEditGroupModal(group: Group): void {
    this.selectedGroupToEdit = group;
    this.showEditGroupModal = true;
  }

  viewGroup(group: Group): void {
    this.router.navigate(['/groups', group.id]);
  }

  openGroupChat(event: Event, group: Group): void {
    event.stopPropagation();
    this.router.navigate(['/groups', group.id, 'chat'], { fragment: 'chat-composer-anchor' });
  }

  closeEditGroupModal(): void {
    this.showEditGroupModal = false;
    this.selectedGroupToEdit = null;
    this.loadGroupCollections();
  }

  onGroupUpdated(updatedGroup: Group): void {
    this.loadGroupCollections();
    this.closeEditGroupModal();
  }

  onGroupDeleted(): void {
    this.closeEditGroupModal();
  }

  isMyGroup(group: Group): boolean {
    return this.myGroups.some((candidate) => candidate.id === group.id);
  }

  canMessageGroup(group: Group): boolean {
    return this.myGroups.some((candidate) => candidate.id === group.id)
      || this.memberGroups.some((candidate) => candidate.id === group.id);
  }

  isMemberGroup(group: Group): boolean {
    return this.memberGroups.some((candidate) => candidate.id === group.id);
  }

  canShowRequestAccessButton(group: Group): boolean {
    return !this.isMyGroup(group)
      && !this.isMemberGroup(group)
      && !this.hasPendingInvitation(group);
  }

  hasPendingJoinRequest(group: Group): boolean {
    return this.pendingJoinRequestGroupIds.has(group.id);
  }

  hasPendingInvitation(group: Group): boolean {
    return this.pendingInvitationGroupIds.has(group.id);
  }

  isRequestingAccess(group: Group): boolean {
    return this.requestingAccessGroupIds.has(group.id);
  }

  isCancelingAccessRequest(group: Group): boolean {
    return this.cancelingAccessRequestGroupIds.has(group.id);
  }

  requestAccess(group: Group): void {
    if (!this.canShowRequestAccessButton(group) || this.hasPendingJoinRequest(group) || this.isRequestingAccess(group)) {
      return;
    }

    this.requestingAccessGroupIds.add(group.id);

    requestGroupAccess(this.groupService, group.id, {
      languageService: this.languageService,
      toastService: this.toastService,
      successKey: 'accessRequested',
      onSuccess: () => {
        this.requestingAccessGroupIds.delete(group.id);
        this.pendingJoinRequestGroupIds.add(group.id);
      },
      onError: (error) => {
        this.requestingAccessGroupIds.delete(group.id);
        this.toastService.showError(this.languageService.translate('requestAccessError'));
        console.error('Error requesting group access from search page:', error);
      },
    });
  }

  cancelAccessRequest(group: Group): void {
    if (!this.canShowRequestAccessButton(group) || !this.hasPendingJoinRequest(group) || this.isCancelingAccessRequest(group)) {
      return;
    }

    this.cancelingAccessRequestGroupIds.add(group.id);

    cancelGroupAccessRequest(this.groupService, group.id, {
      languageService: this.languageService,
      toastService: this.toastService,
      successKey: 'joinRequestCancelled',
      onSuccess: () => {
        this.cancelingAccessRequestGroupIds.delete(group.id);
        this.pendingJoinRequestGroupIds.delete(group.id);
      },
      onError: (error) => {
        this.cancelingAccessRequestGroupIds.delete(group.id);
        this.toastService.showError(this.languageService.translate('cancelJoinRequestError'));
        console.error('Error cancelling group access request from search page:', error);
      },
    });
  }

  isRespondingToInvitation(group: Group): boolean {
    return this.respondingToInvitationGroupIds.has(group.id);
  }

  acceptInvitation(group: Group): void {
    this.respondToInvitation(group, true);
  }

  declineInvitation(group: Group): void {
    this.respondToInvitation(group, false);
  }

  private respondToInvitation(group: Group, accept: boolean): void {
    const membershipId = this.pendingInvitationMembershipIdByGroupId.get(group.id);
    if (!membershipId || !this.hasPendingInvitation(group) || this.isRespondingToInvitation(group)) {
      return;
    }

    this.respondingToInvitationGroupIds.add(group.id);

    respondToGroupInvitation(this.groupService, membershipId, accept, group.id, {
      onSuccess: () => {
        this.respondingToInvitationGroupIds.delete(group.id);
        this.pendingInvitationGroupIds.delete(group.id);
        this.pendingInvitationMembershipIdByGroupId.delete(group.id);
        this.toastService.showSuccess(this.languageService.translate(accept ? 'invitationAccepted' : 'invitationDeclined'));
        this.loadGroupCollections();
      },
      onError: (error) => {
        this.respondingToInvitationGroupIds.delete(group.id);
        this.toastService.showError(this.languageService.translate('invitationResponseError'));
        console.error('Error responding to group invitation from search page:', error);
      },
    });
  }

  getEmptyStateKey(): string {
    if (this.activeFilter === 'all') {
      return 'noGroupsFound';
    }

    return this.activeFilter === 'admin' ? 'noAdminGroups' : 'noMemberGroups';
  }

  retryLoadGroups(): void {
    this.loadGroupCollections();
  }

  private loadGroupCollections(): void {
    this.isLoadingGroups = true;
    this.errorMessage = '';

    forkJoin({
      allGroups: this.groupService.searchGroups(),
      adminGroups: this.groupService.getMyGroups(),
      memberGroups: this.groupService.getMemberGroups(),
      pendingJoinRequestGroups: this.groupService.getPendingJoinRequestGroups(),
      pendingInvitationGroups: this.groupService.getPendingInvitationGroups(),
    }).subscribe({
      next: ({ allGroups, adminGroups, memberGroups, pendingJoinRequestGroups, pendingInvitationGroups }) => {
        this.myGroups = adminGroups;
        this.memberGroups = memberGroups;
        this.allGroups = this.mergeUniqueGroups(allGroups, adminGroups, memberGroups, pendingJoinRequestGroups, pendingInvitationGroups);

        if (!this.myGroups.length && !this.memberGroups.length) {
          this.activeFilter = 'all';
        } else if (this.activeFilter === 'all') {
          this.activeFilter = this.myGroups.length ? 'admin' : 'membership';
        } else if (this.activeFilter === 'admin' && !this.myGroups.length && this.memberGroups.length) {
          this.activeFilter = 'membership';
        }

        this.syncAccessRequestStates();
      },
      error: (error) => {
        console.error('Error loading group collections for search groups page:', error);
        this.allGroups = [];
        this.myGroups = [];
        this.memberGroups = [];
        this.pendingJoinRequestGroupIds.clear();
        this.pendingInvitationGroupIds.clear();
        this.isLoadingGroups = false;
        this.errorMessage = this.languageService.translate('groupsLoadError');
        this.applyFiltersAndSort();
      },
    });
  }

  private mergeUniqueGroups(...groupCollections: Group[][]): Group[] {
    const uniqueGroups = new Map<number, Group>();

    groupCollections.flat().forEach((group) => {
      uniqueGroups.set(group.id, group);
    });

    return Array.from(uniqueGroups.values());
  }

  private applyFiltersAndSort(): void {
    const sourceGroups =
      this.activeFilter === 'all'
        ? this.allGroups
        : this.activeFilter === 'admin'
          ? this.myGroups
          : this.memberGroups;

    let nextGroups = sourceGroups.filter((group) =>
      matchesSearchQuery(
        [
        group.name,
        group.description,
        group.grad,
        group.kategorijaSporta,
        ],
        this.searchQuery,
      ),
    );

    nextGroups = sortItemsByText(nextGroups, (group) => group.name, this.activeSort);

    this.filteredGroups = nextGroups;
    this.setupPagination();
  }

  private syncAccessRequestStates(): void {
    const candidateGroups = this.allGroups.filter((group) => !this.isMyGroup(group) && !this.isMemberGroup(group));

    if (!candidateGroups.length) {
      this.pendingJoinRequestGroupIds.clear();
      this.pendingInvitationGroupIds.clear();
      this.pendingInvitationMembershipIdByGroupId.clear();
      this.isLoadingGroups = false;
      this.applyFiltersAndSort();
      return;
    }

    forkJoin(
      candidateGroups.map((group) =>
        this.groupService.getGroupDetails(group.id).pipe(
          catchError(() => of(null as GroupDetails | null)),
        ),
      ),
    ).subscribe({
      next: (groupDetails) => {
        this.pendingJoinRequestGroupIds.clear();
        this.pendingInvitationGroupIds.clear();
        this.pendingInvitationMembershipIdByGroupId.clear();

        groupDetails.forEach((details, index) => {
          if (!details) {
            return;
          }

          const groupId = candidateGroups[index].id;

          if (details.hasPendingJoinRequest) {
            this.pendingJoinRequestGroupIds.add(groupId);
          }

          if (details.hasPendingInvitation) {
            this.pendingInvitationGroupIds.add(groupId);

            if (details.pendingInvitationMembershipId) {
              this.pendingInvitationMembershipIdByGroupId.set(groupId, details.pendingInvitationMembershipId);
            }
          }
        });

        this.isLoadingGroups = false;
        this.applyFiltersAndSort();
      },
      error: (error) => {
        console.error('Error loading access request states for search groups page:', error);
        this.pendingJoinRequestGroupIds.clear();
        this.pendingInvitationGroupIds.clear();
        this.pendingInvitationMembershipIdByGroupId.clear();
        this.isLoadingGroups = false;
        this.applyFiltersAndSort();
      },
    });
  }
}
