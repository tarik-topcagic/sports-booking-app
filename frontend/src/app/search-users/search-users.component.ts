import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../pipes/translate.pipe';
import { UserService } from '../../services/user.service';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { User } from '../interfaces/user';
import { ChooseGroupModalComponent } from '../choose-group-modal/choose-group-modal.component';
import { SkeletonListItemComponent } from '../skeleton/skeleton-list-item/skeleton-list-item.component';
import { LoadErrorStateComponent } from '../load-error-state/load-error-state.component';
import { PaginationComponent } from '../pagination/pagination.component';
import { GroupService } from '../../services/group.service';
import { catchError, forkJoin, of, Subscription, tap, throwError, timeout } from 'rxjs';
import { Group, GroupDetails } from '../interfaces/group.model';
import { SearchSortDirection, sortItemsByText } from '../helpers/search.helper';
import { DropdownCoordinatorService } from '../../services/dropdown-coordinator.service';

const OPEN_CHAT_TIMEOUT_MS = 15000;

@Component({
  selector: 'app-search-users',
  imports: [NgFor, NgIf, NgClass, FormsModule, TranslatePipe, ChooseGroupModalComponent, SkeletonListItemComponent, LoadErrorStateComponent, PaginationComponent],
  templateUrl: './search-users.component.html',
  styleUrl: './search-users.component.scss',
})
export class SearchUsersComponent implements OnInit, OnDestroy {
  searchQuery = '';
  users: User[] = [];
  filteredUsers: User[] = [];
  currentUsername = '';
  activeFilter: 'allUsers' | 'commonGroups' = 'allUsers';
  activeSort: SearchSortDirection = 'asc';
  showFilterMenu = false;
  showSortMenu = false;
  selectedUserForGroupInvite: User | null = null;
  @ViewChild('usersState') usersState!: LoadErrorStateComponent;
  @ViewChild('filterMenuWrapper') filterMenuWrapperRef!: ElementRef<HTMLElement>;
  @ViewChild('sortMenuWrapper') sortMenuWrapperRef!: ElementRef<HTMLElement>;

  isLoadingCommonGroups = false;
  openingChatUserId: string | null = null;

  pagedUsers: User[] = [];
  itemsPerPage = 6;
  resetPageSignal = 0;

  private commonGroupUserIds = new Set<string>();
  private readonly filterMenuId: unknown = {};
  private readonly sortMenuId: unknown = {};
  private coordinatorSubscription?: Subscription;

  constructor(
    private userService: UserService,
    private router: Router,
    private authService: AuthService,
    private groupService: GroupService,
    private dropdownCoordinator: DropdownCoordinatorService,
  ) {
    const currentUser = this.authService.currentUserValue;
    if (currentUser) {
      this.currentUsername = currentUser.username;
    }

    this.coordinatorSubscription = this.dropdownCoordinator.activeChanged$.subscribe((activeId) => {
      if (activeId !== this.filterMenuId) {
        this.showFilterMenu = false;
      }
      if (activeId !== this.sortMenuId) {
        this.showSortMenu = false;
      }
    });
  }

  ngOnInit(): void {
    this.loadCommonGroupUsers();
  }

  ngOnDestroy(): void {
    this.coordinatorSubscription?.unsubscribe();
    this.dropdownCoordinator.close(this.filterMenuId);
    this.dropdownCoordinator.close(this.sortMenuId);
  }

  loadUsers = () => this.userService.searchUsers(this.searchQuery).pipe(
    tap((response) => {
      this.users = response;
      this.applyFiltersAndSort();
    }),
    catchError((error) => {
      console.error('Error loading users from search page:', error);
      this.users = [];
      this.applyFiltersAndSort();
      return throwError(() => error);
    }),
  );

  searchUsers(): void {
    this.usersState.reload();
  }

  onSearchQueryChange(): void {
    this.usersState.reload();
  }

  onFilterChange(): void {
    this.applyFiltersAndSort();
  }

  toggleFilterMenu(): void {
    if (this.showFilterMenu) {
      this.closeFilterMenu();
      return;
    }

    this.dropdownCoordinator.open(this.filterMenuId, this.filterMenuWrapperRef.nativeElement);
    this.showFilterMenu = true;
  }

  selectFilter(filter: 'allUsers' | 'commonGroups'): void {
    this.activeFilter = filter;
    this.closeFilterMenu();
    this.onFilterChange();
  }

  onSortChange(): void {
    this.applyFiltersAndSort();
  }

  toggleSortMenu(): void {
    if (this.showSortMenu) {
      this.closeSortMenu();
      return;
    }

    this.dropdownCoordinator.open(this.sortMenuId, this.sortMenuWrapperRef.nativeElement);
    this.showSortMenu = true;
  }

  selectSortDirection(direction: SearchSortDirection): void {
    this.activeSort = direction;
    this.closeSortMenu();
    this.onSortChange();
  }

  private closeFilterMenu(): void {
    this.showFilterMenu = false;
    this.dropdownCoordinator.close(this.filterMenuId);
  }

  private closeSortMenu(): void {
    this.showSortMenu = false;
    this.dropdownCoordinator.close(this.sortMenuId);
  }

  onPagedUsersChange(pagedUsers: User[]): void {
    this.pagedUsers = pagedUsers;
  }

  goToProfile(user: User): void {
    this.router.navigate(['/users', user.username]);
  }

  viewProfile(event: Event, user: User): void {
    event.stopPropagation();
    if (user.username === this.currentUsername) {
      this.router.navigate(['/profile']);
      return;
    }

    this.goToProfile(user);
  }

  editProfile(event: Event, user: User): void {
    event.stopPropagation();
    if (user.username === this.currentUsername) {
      this.router.navigate(['/profile/edit']);
    }
  }

  openChooseGroupModal(event: Event, user: User): void {
    event.stopPropagation();

    if (!user.id) {
      return;
    }

    this.selectedUserForGroupInvite = user;
  }

  isOpeningChat(user: User): boolean {
    return this.openingChatUserId !== null
      && (this.openingChatUserId === user.id || this.openingChatUserId === user.username);
  }

  openPrivateChat(event: Event, user: User): void {
    event.stopPropagation();

    if (this.openingChatUserId) {
      return;
    }

    if (user.id) {
      this.router.navigate(['/messages/private/user', user.id]);
      return;
    }

    if (!user.username) {
      console.error('Cannot open private chat from user search because user id and username are missing.');
      return;
    }

    this.openingChatUserId = user.username;

    this.userService.getUserProfileByUsername(user.username).pipe(
      timeout(OPEN_CHAT_TIMEOUT_MS),
    ).subscribe({
      next: (resolvedUser) => {
        this.openingChatUserId = null;

        if (!resolvedUser.id) {
          console.error('Cannot open private chat from user search because resolved user id is missing.');
          return;
        }

        this.router.navigate(['/messages/private/user', resolvedUser.id]);
      },
      error: (error) => {
        this.openingChatUserId = null;
        console.error('Error resolving target user before opening private chat from user search:', error);
      },
    });
  }

  closeChooseGroupModal(): void {
    this.selectedUserForGroupInvite = null;
  }

  getDisplayName(user: User): string {
    return user.fullName || user.username || '';
  }

  private applyFiltersAndSort(): void {
    let nextUsers = [...this.users];

    if (this.activeFilter === 'commonGroups') {
      nextUsers = nextUsers.filter((user) => this.commonGroupUserIds.has(user.id));
    }

    this.filteredUsers = sortItemsByText(nextUsers, (user) => this.getDisplayName(user), this.activeSort);
    this.resetPageSignal++;
  }

  private loadCommonGroupUsers(): void {
    this.isLoadingCommonGroups = true;

    forkJoin({
      adminGroups: this.groupService.getMyGroups().pipe(catchError(() => of([] as Group[]))),
      memberGroups: this.groupService.getMemberGroups().pipe(catchError(() => of([] as Group[]))),
    }).subscribe({
      next: ({ adminGroups, memberGroups }) => {
        const uniqueGroupIds = Array.from(
          new Set([...adminGroups, ...memberGroups].map((group) => group.id)),
        );

        if (!uniqueGroupIds.length) {
          this.commonGroupUserIds.clear();
          this.isLoadingCommonGroups = false;
          this.applyFiltersAndSort();
          return;
        }

        forkJoin(
          uniqueGroupIds.map((groupId) =>
            this.groupService.getGroupDetails(groupId).pipe(
              catchError(() => of(null as GroupDetails | null)),
            ),
          ),
        ).subscribe({
          next: (details) => {
            const nextCommonUserIds = new Set<string>();

            details
              .filter((group): group is GroupDetails => group !== null)
              .forEach((group) => {
                group.members.forEach((member) => {
                  if (member.username !== this.currentUsername) {
                    nextCommonUserIds.add(member.userId);
                  }
                });
              });

            this.commonGroupUserIds = nextCommonUserIds;
            this.isLoadingCommonGroups = false;
            this.applyFiltersAndSort();
          },
          error: (error) => {
            console.error('Error resolving common group users:', error);
            this.commonGroupUserIds.clear();
            this.isLoadingCommonGroups = false;
            this.applyFiltersAndSort();
          },
        });
      },
      error: (error) => {
        console.error('Error loading groups for common user filter:', error);
        this.commonGroupUserIds.clear();
        this.isLoadingCommonGroups = false;
        this.applyFiltersAndSort();
      },
    });
  }
}
