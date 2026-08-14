import { DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Group, GroupDetails } from '../interfaces/group.model';
import { GroupService } from '../../services/group.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { NavbarComponent } from '../navbar/navbar.component';
import { LanguageService } from '../../services/language.service';
import { PresenceService } from '../../services/presence.service';
import { EditGroupModalComponent } from '../edit-group-modal/edit-group-modal.component';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { Subscription } from 'rxjs';
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
    DatePipe,
    NgIf,
    NgFor,
    RouterLink,
    NavbarComponent,
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
  group: GroupDetails | null = null;
  selectedGroupToEdit: Group | null = null;
  isLoading = true;
  isRequestingAccess = false;
  isCancelingAccessRequest = false;
  isRespondingToInvitation = false;
  isLeavingGroup = false;
  showEditGroupModal = false;
  showInviteMembersModal = false;
  showMembersModal = false;
  isMemberMenuOpen = false;
  errorMessage = '';
  canShowPresence = false;
  onlineMemberUserIds = new Set<string>();
  private routeSubscription?: Subscription;
  private groupDetailsRefreshSubscription?: Subscription;
  private presenceSubscription?: Subscription;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private groupService: GroupService,
    private languageService: LanguageService,
    private confirmDialogService: ConfirmDialogService,
    private presenceService: PresenceService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      const groupId = Number(params.get('id'));

      if (!groupId) {
        this.router.navigate(['/groups']);
        return;
      }

      this.resetViewStateForRouteChange();
      this.loadGroup(groupId);
    });

    this.groupDetailsRefreshSubscription = this.groupService.groupDetailsRefresh$.subscribe((groupId) => {
      if (this.group?.id === groupId) {
        this.loadGroup(groupId);
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
    void this.presenceService.disconnectRealtime();
  }

  hasOnlineMembers(): boolean {
    return this.onlineMemberUserIds.size > 0;
  }

  requestAccess(): void {
    if (!this.group || this.group.isAdmin || this.group.isMember || this.group.hasPendingJoinRequest) {
      return;
    }

    this.isRequestingAccess = true;
    this.errorMessage = '';

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
    this.errorMessage = '';

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
    this.loadGroup(updatedGroup.id);
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
    this.isMemberMenuOpen = !this.isMemberMenuOpen;
  }

  @HostListener('document:click', ['$event'])
  closeMemberMenuOnOutsideClick(event: MouseEvent): void {
    const target = event.target as HTMLElement | null;

    if (this.isMemberMenuOpen && !target?.closest('.member-status-dropdown')) {
      this.isMemberMenuOpen = false;
    }
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
    this.errorMessage = '';
    this.canShowPresence = false;
    this.onlineMemberUserIds.clear();
  }

  retryLoadGroup(): void {
    const groupId = Number(this.route.snapshot.paramMap.get('id'));
    if (groupId) {
      this.loadGroup(groupId);
    }
  }

  private loadGroup(groupId: number): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.groupService.getGroupDetails(groupId).subscribe(
      (group) => {
        this.group = group;
        this.isMemberMenuOpen = false;
        this.isLoading = false;
        this.loadGroupPresence(group.id);
      },
      (error) => {
        this.isLoading = false;
        this.errorMessage = this.languageService.translate('groupDetailsLoadError');
        console.error('Error loading group details:', error);
      },
    );
  }

  private respondToInvitation(accept: boolean): void {
    if (!this.group?.hasPendingInvitation || !this.group.pendingInvitationMembershipId || this.isRespondingToInvitation) {
      return;
    }

    this.isRespondingToInvitation = true;
    this.errorMessage = '';

    respondToGroupInvitation(
      this.groupService,
      this.group.pendingInvitationMembershipId,
      accept,
      this.group.id,
      {
        onSuccess: () => {
        this.isRespondingToInvitation = false;
        this.toastService.showSuccess(this.languageService.translate(accept ? 'invitationAccepted' : 'invitationDeclined'));
        this.loadGroup(this.group!.id);
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
      this.loadGroup(this.group.id);
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
