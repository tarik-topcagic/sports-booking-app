import { NgFor, NgIf } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Group, GroupDetails } from '../interfaces/group.model';
import { GroupService } from '../../services/group.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { LanguageService } from '../../services/language.service';
import { PresenceService } from '../../services/presence.service';
import { EditGroupModalComponent } from '../edit-group-modal/edit-group-modal.component';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { DropdownCoordinatorService } from '../../services/dropdown-coordinator.service';
import { getMonthAbbreviationKey } from '../helpers/date-format.helper';
import { catchError, NEVER, Subscription, tap, throwError } from 'rxjs';
import { GroupInviteMembersModalComponent } from '../group-invite-members-modal/group-invite-members-modal.component';
import { GroupMembersModalComponent } from '../group-members-modal/group-members-modal.component';
import { GroupPresence } from '../interfaces/group-presence.model';
import { UserPresence } from '../interfaces/user-presence.model';
import { ToastService } from '../../services/toast.service';
import { SkeletonComponent } from '../skeleton/skeleton/skeleton.component';
import { LoadErrorStateComponent } from '../load-error-state/load-error-state.component';
import {
  cancelGroupAccessRequest,
  requestGroupAccess,
  respondToGroupInvitation,
} from '../helpers/group-membership-actions.helper';

@Component({
  selector: 'app-group-details',
  imports: [
    NgIf,
    NgFor,
    RouterLink,
    TranslatePipe,
    EditGroupModalComponent,
    GroupInviteMembersModalComponent,
    GroupMembersModalComponent,
    SkeletonComponent,
    LoadErrorStateComponent,
  ],
  templateUrl: './group-details.component.html',
  styleUrl: './group-details.component.scss'
})
export class GroupDetailsComponent implements OnInit, OnDestroy {
  @ViewChild('groupState') groupState!: LoadErrorStateComponent;
  @ViewChild('memberStatusDropdown') memberStatusDropdownRef?: ElementRef<HTMLElement>;

  group: GroupDetails | null = null;
  selectedGroupToEdit: Group | null = null;
  isRequestingAccess = false;
  isCancelingAccessRequest = false;
  isRespondingToInvitation = false;
  isLeavingGroup = false;
  showEditGroupModal = false;
  showInviteMembersModal = false;
  showMembersModal = false;
  isMemberMenuOpen = false;
  canShowPresence = false;
  onlineMemberUserIds = new Set<string>();
  private routeSubscription?: Subscription;
  private groupDetailsRefreshSubscription?: Subscription;
  private presenceSubscription?: Subscription;
  private coordinatorSubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private groupService: GroupService,
    private languageService: LanguageService,
    private confirmDialogService: ConfirmDialogService,
    private presenceService: PresenceService,
    private toastService: ToastService,
    private dropdownCoordinator: DropdownCoordinatorService,
  ) {
    this.coordinatorSubscription = this.dropdownCoordinator.activeChanged$.subscribe((activeId) => {
      if (activeId !== this && this.isMemberMenuOpen) {
        this.isMemberMenuOpen = false;
      }
    });
  }

  private isInitialRouteParamsEmission = true;

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      const groupId = Number(params.get('id'));

      if (!groupId) {
        this.router.navigate(['/groups']);
        return;
      }

      if (this.isInitialRouteParamsEmission) {
        this.isInitialRouteParamsEmission = false;
        return;
      }

      this.resetViewStateForRouteChange();
      this.groupState.reload();
    });

    this.groupDetailsRefreshSubscription = this.groupService.groupDetailsRefresh$.subscribe((groupId) => {
      if (this.group?.id === groupId) {
        this.groupState.reload();
      }
    });

    this.presenceSubscription = this.presenceService.presenceUpdates$.subscribe((update) => {
      this.handlePresenceUpdate(update);
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
    this.groupDetailsRefreshSubscription?.unsubscribe();
    this.presenceSubscription?.unsubscribe();
    this.coordinatorSubscription?.unsubscribe();
    this.dropdownCoordinator.close(this);
    void this.presenceService.disconnectRealtime();
  }

  hasOnlineMembers(): boolean {
    return this.onlineMemberUserIds.size > 0;
  }

  formatDateCreated(date: Date | string): string {
    const parsedDate = date instanceof Date ? date : new Date(date);
    const month = this.languageService.translate(getMonthAbbreviationKey(parsedDate));
    const day = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(parsedDate);
    const year = new Intl.DateTimeFormat('en-US', { year: 'numeric' }).format(parsedDate);

    return `${day} ${month} ${year}`;
  }

  requestAccess(): void {
    if (!this.group || this.group.isAdmin || this.group.isMember || this.group.hasPendingJoinRequest) {
      return;
    }

    this.isRequestingAccess = true;

    requestGroupAccess(this.groupService, this.group.id, {
      languageService: this.languageService,
      toastService: this.toastService,
      successKey: 'accessRequested',
      onSuccess: () => {
        this.isRequestingAccess = false;
        this.group = this.group ? { ...this.group, hasPendingJoinRequest: true } : null;
      },
      onError: (error) => {
        this.isRequestingAccess = false;
        this.toastService.showError(this.languageService.translate('requestAccessError'));
        console.error('Error requesting group access:', error);
      },
    });
  }

  cancelAccessRequest(): void {
    if (!this.group || this.group.isAdmin || this.group.isMember || !this.group.hasPendingJoinRequest) {
      return;
    }

    this.isCancelingAccessRequest = true;

    cancelGroupAccessRequest(this.groupService, this.group.id, {
      languageService: this.languageService,
      toastService: this.toastService,
      successKey: 'joinRequestCancelled',
      onSuccess: () => {
        this.isCancelingAccessRequest = false;
        this.group = this.group ? { ...this.group, hasPendingJoinRequest: false } : null;
      },
      onError: (error) => {
        this.isCancelingAccessRequest = false;
        this.toastService.showError(this.languageService.translate('cancelJoinRequestError'));
        console.error('Error cancelling join request:', error);
      },
    });
  }

  acceptInvitation(): void {
    this.respondToInvitation(true);
  }

  declineInvitation(): void {
    this.respondToInvitation(false);
  }

  openEditGroupModal(): void {
    if (!this.group?.isAdmin) {
      return;
    }

    this.selectedGroupToEdit = this.toEditableGroup(this.group);
    this.showEditGroupModal = true;
  }

  closeEditGroupModal(): void {
    this.showEditGroupModal = false;
    this.selectedGroupToEdit = null;
  }

  onGroupUpdated(updatedGroup: Group): void {
    this.closeEditGroupModal();
    this.groupState.reload();
  }

  onGroupDeleted(): void {
    this.closeEditGroupModal();
    this.router.navigate(['/groups'], {
      state: { successMessageKey: 'groupDeleted' },
    });
  }

  openInviteMembersModal(): void {
    if (!this.group?.isAdmin) {
      return;
    }

    this.showInviteMembersModal = true;
  }

  closeInviteMembersModal(): void {
    this.showInviteMembersModal = false;
  }

  openMembersModal(): void {
    if (!this.group?.isMember) {
      return;
    }

    this.showMembersModal = true;
  }

  closeMembersModal(): void {
    this.showMembersModal = false;
  }

  toggleMemberMenu(): void {
    if (this.isMemberMenuOpen) {
      this.isMemberMenuOpen = false;
      this.dropdownCoordinator.close(this);
      return;
    }

    if (this.memberStatusDropdownRef) {
      this.dropdownCoordinator.open(this, this.memberStatusDropdownRef.nativeElement);
    }

    this.isMemberMenuOpen = true;
  }

  async leaveGroup(): Promise<void> {
    if (!this.group || this.group.isAdmin || !this.group.isMember || this.isLeavingGroup) {
      return;
    }

    if (!(await this.confirmDialogService.confirm('confirmLeaveGroup'))) {
      return;
    }

    const currentUserId = this.group.currentUserId;
    this.isMemberMenuOpen = false;
    this.dropdownCoordinator.close(this);
    this.isLeavingGroup = true;

    this.groupService.removeMember(this.group.id, currentUserId).subscribe(
      () => {
        this.isLeavingGroup = false;
        this.group = this.group
          ? {
              ...this.group,
              isMember: false,
              members: this.group.members.filter(member => member.userId !== currentUserId),
              membersCount: Math.max(0, this.group.membersCount - 1),
            }
          : null;
        this.toastService.showSuccess(this.languageService.translate('leftGroup'));
      },
      (error) => {
        this.isLeavingGroup = false;
        this.toastService.showError(this.languageService.translate('leaveGroupError'));
        console.error('Error leaving group:', error);
      },
    );
  }

  private resetViewStateForRouteChange(): void {
    this.group = null;
    this.selectedGroupToEdit = null;
    this.isRequestingAccess = false;
    this.isCancelingAccessRequest = false;
    this.isRespondingToInvitation = false;
    this.isLeavingGroup = false;
    this.showEditGroupModal = false;
    this.showInviteMembersModal = false;
    this.showMembersModal = false;
    this.isMemberMenuOpen = false;
    this.canShowPresence = false;
    this.onlineMemberUserIds.clear();
  }

  loadGroup = () => {
    const groupId = Number(this.route.snapshot.paramMap.get('id'));
    if (!groupId) {
      return NEVER;
    }

    return this.groupService.getGroupDetails(groupId).pipe(
      tap((group) => {
        this.group = group;
        this.isMemberMenuOpen = false;
        this.loadGroupPresence(group.id);
      }),
      catchError((error) => {
        console.error('Error loading group details:', error);
        return throwError(() => error);
      }),
    );
  }

  private respondToInvitation(accept: boolean): void {
    if (!this.group?.hasPendingInvitation || !this.group.pendingInvitationMembershipId || this.isRespondingToInvitation) {
      return;
    }

    this.isRespondingToInvitation = true;

    respondToGroupInvitation(
      this.groupService,
      this.group.pendingInvitationMembershipId,
      accept,
      this.group.id,
      {
        onSuccess: () => {
        this.isRespondingToInvitation = false;
        this.toastService.showSuccess(this.languageService.translate(accept ? 'invitationAccepted' : 'invitationDeclined'));
        this.groupState.reload();
      },
        onError: (error) => {
        this.isRespondingToInvitation = false;
        this.toastService.showError(this.languageService.translate('invitationResponseError'));
        console.error('Error responding to group invitation:', error);
      },
      },
    );
  }

  private toEditableGroup(group: GroupDetails): Group {
    return {
      id: group.id,
      name: group.name,
      description: group.description,
      city: group.city,
      sportCategory: group.sportCategory,
      adminId: group.currentUserId,
      imageUrl: group.imageUrl,
      createdAt: group.dateCreated,
      dateCreated: group.dateCreated,
      membersCount: group.membersCount,
    };
  }

  onInviteMembersGroupDetailsRefresh(): void {
    if (this.group) {
      this.groupState.reload();
    }
  }

  onMemberRemoved(memberId: string): void {
    this.group = this.group
      ? {
          ...this.group,
          members: this.group.members.filter(existingMember => existingMember.userId !== memberId),
          membersCount: Math.max(0, this.group.membersCount - 1),
        }
      : null;
    this.toastService.showSuccess(
      this.languageService.translate('memberRemovedFromGroup'),
    );
  }

  onMembersModalError(message: string): void {
    this.toastService.showError(message);
  }

  private loadGroupPresence(groupId: number): void {
    void this.presenceService.connectRealtime();

    this.presenceService.getGroupPresence(groupId).subscribe({
      next: (presence) => {
        this.canShowPresence = true;
        this.applyGroupPresence(presence);
      },
      error: () => {
        this.canShowPresence = false;
        this.onlineMemberUserIds.clear();
      },
    });
  }

  private handlePresenceUpdate(update: UserPresence): void {
    if (!this.group || !this.canShowPresence || !this.isPresenceRelevant(update.userId)) {
      return;
    }

    const nextOnlineIds = new Set(this.onlineMemberUserIds);

    if (update.isOnline) {
      nextOnlineIds.add(update.userId);
    } else {
      nextOnlineIds.delete(update.userId);
    }

    this.onlineMemberUserIds = nextOnlineIds;
  }

  private applyGroupPresence(presence: GroupPresence): void {
    this.onlineMemberUserIds = new Set(
      presence.onlineUserIds.filter((userId) => this.isPresenceRelevant(userId)),
    );
  }

  private isPresenceRelevant(userId: string): boolean {
    return !!this.group
      && this.group.members.some((member) => member.userId === userId);
  }

  get groupAdminId(): string | null {
    return this.group?.members.find((member) => member.isAdmin)?.userId ?? null;
  }
}
