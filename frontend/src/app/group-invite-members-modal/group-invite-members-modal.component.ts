import { NgFor, NgIf } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GroupMembership, MembershipStatus } from '../interfaces/group.model';
import { User } from '../interfaces/user';
import { TranslatePipe } from '../pipes/translate.pipe';
import { GroupService } from '../../services/group.service';
import { UserService } from '../../services/user.service';
import { LanguageService } from '../../services/language.service';
import { ToastService } from '../../services/toast.service';
import {
  getMembershipInviteIcon,
  getMembershipInviteLabel,
  hasActiveMembershipConnection,
  isAcceptedMember,
  isPendingInvitation,
  isPendingJoinRequest,
} from '../helpers/membership-ui.helper';
import {
  cancelGroupInvitation,
  respondToGroupJoinRequest,
  sendGroupInvitation,
} from '../helpers/group-membership-actions.helper';

@Component({
  selector: 'app-group-invite-members-modal',
  imports: [NgFor, NgIf, FormsModule, TranslatePipe],
  templateUrl: './group-invite-members-modal.component.html',
  styleUrl: './group-invite-members-modal.component.scss'
})
export class GroupInviteMembersModalComponent implements OnChanges {
  @Input() groupId: number | null = null;
  @Input() groupAdminId: string | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() groupDetailsRefresh = new EventEmitter<void>();

  inviteSearchQuery = '';
  inviteUsers: User[] = [];
  isLoadingInviteUsers = false;
  invitationStatuses = new Map<string, MembershipStatus>();
  membershipsByUserId = new Map<string, GroupMembership>();
  invitingUserIds = new Set<string>();
  cancelingInvitationUserIds = new Set<string>();
  respondingJoinRequestUserIds = new Set<string>();
  inviteModalMessage = '';
  inviteModalError = '';

  constructor(
    private groupService: GroupService,
    private userService: UserService,
    private languageService: LanguageService,
    private toastService: ToastService,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['groupId'] && this.groupId) {
      this.resetModalState();
      this.loadInvitationStatuses();
      this.loadInviteUsers();
    }
  }

  closeModal(): void {
    this.resetModalState();
    this.close.emit();
  }

  searchInviteUsers(): void {
    this.loadInviteUsers(this.inviteSearchQuery);
  }

  handleInviteAction(user: User): void {
    if (this.canCancelPendingConnection(user)) {
      this.cancelPendingConnection(user);
      return;
    }

    this.inviteUser(user);
  }

  inviteUser(user: User): void {
    if (!this.groupId || !user.id || !this.canInviteUser(user)) {
      return;
    }

    this.invitingUserIds.add(user.id);
    this.inviteModalMessage = '';
    this.inviteModalError = '';

    sendGroupInvitation(this.groupService, this.groupId, user.id, {
      languageService: this.languageService,
      toastService: this.toastService,
      successKey: 'invitationSent',
      onSuccess: () => {
        this.invitingUserIds.delete(user.id);
        this.invitationStatuses.set(user.id, MembershipStatus.PendingInvitation);
      },
      onError: (error) => {
        this.invitingUserIds.delete(user.id);

        if (error?.status === 400) {
          this.invitationStatuses.set(user.id, MembershipStatus.PendingInvitation);
          this.inviteModalMessage = this.languageService.translate('pending');
        } else {
          this.toastService.showError(this.languageService.translate('invitationSendError'));
        }

        console.error('Error sending group invitation:', error);
      },
    });
  }

  cancelInvitation(user: User): void {
    if (!this.groupId || !user.id || !this.canCancelInvitation(user)) {
      return;
    }

    this.cancelingInvitationUserIds.add(user.id);
    this.inviteModalMessage = '';
    this.inviteModalError = '';

    cancelGroupInvitation(this.groupService, this.groupId, user.id, {
      languageService: this.languageService,
      toastService: this.toastService,
      successKey: 'invitationCancelled',
      onSuccess: () => {
        this.cancelingInvitationUserIds.delete(user.id);
        this.invitationStatuses.delete(user.id);
        this.membershipsByUserId.delete(user.id);
      },
      onError: (error) => {
        this.cancelingInvitationUserIds.delete(user.id);
        this.toastService.showError(this.languageService.translate('cancelInvitationError'));
        console.error('Error cancelling group invitation:', error);
      },
    });
  }

  acceptJoinRequest(user: User): void {
    this.respondToJoinRequest(user, true);
  }

  declineJoinRequest(user: User): void {
    this.respondToJoinRequest(user, false);
  }

  respondToJoinRequest(user: User, accept: boolean): void {
    if (!this.groupId || !user.id || !this.canRespondToJoinRequest(user)) {
      return;
    }

    const membership = this.membershipsByUserId.get(user.id);
    if (!membership) {
      return;
    }

    this.respondingJoinRequestUserIds.add(user.id);
    this.inviteModalMessage = '';
    this.inviteModalError = '';

    respondToGroupJoinRequest(this.groupService, this.groupId, membership.id, accept, {
      onSuccess: () => {
        this.respondingJoinRequestUserIds.delete(user.id);

        if (accept) {
          const updatedMembership = { ...membership, status: MembershipStatus.Accepted };
          this.invitationStatuses.set(user.id, MembershipStatus.Accepted);
          this.membershipsByUserId.set(user.id, updatedMembership);
          this.toastService.showSuccess(this.languageService.translate('joinRequestAccepted'));
          this.groupDetailsRefresh.emit();
        } else {
          this.invitationStatuses.delete(user.id);
          this.membershipsByUserId.delete(user.id);
          this.toastService.showSuccess(this.languageService.translate('joinRequestDeclined'));
        }
      },
      onError: (error) => {
        this.respondingJoinRequestUserIds.delete(user.id);
        this.toastService.showError(this.languageService.translate('joinRequestResponseError'));
        console.error('Error responding to pending join request:', error);
      },
    });
  }

  getInviteLabel(user: User): string {
    if (this.isGroupAdmin(user)) {
      return 'admin';
    }

    return getMembershipInviteLabel(
      this.getInvitationStatus(user),
      this.isInviting(user),
      this.isCancelingInvitation(user),
    );
  }

  isGroupAdmin(user: User): boolean {
    return !!user.id && !!this.groupAdminId && user.id === this.groupAdminId;
  }

  isInviting(user: User): boolean {
    return !!user.id && this.invitingUserIds.has(user.id);
  }

  isCancelingInvitation(user: User): boolean {
    return !!user.id && this.cancelingInvitationUserIds.has(user.id);
  }

  isRespondingJoinRequest(user: User): boolean {
    return !!user.id && this.respondingJoinRequestUserIds.has(user.id);
  }

  isInvitationBlocked(user: User): boolean {
    return this.hasAnyActiveConnection(user);
  }

  isInviteActionDisabled(user: User): boolean {
    return this.isInviting(user)
      || this.isCancelingInvitation(user)
      || this.isRespondingJoinRequest(user)
      || this.isAcceptedMember(user);
  }

  canInviteUser(user: User): boolean {
    return !!this.groupId
      && !!user.id
      && !this.hasAnyActiveConnection(user)
      && !this.isInviting(user)
      && !this.isCancelingInvitation(user);
  }

  getInviteActionTitle(user: User): string {
    if (this.canCancelInvitation(user)) {
      return 'cancelInvitation';
    }

    if (this.canCancelPendingJoinRequest(user)) {
      return 'cancelJoinRequest';
    }

    return this.getInviteLabel(user);
  }

  getInviteActionIcon(user: User): string {
    return getMembershipInviteIcon(this.getInvitationStatus(user));
  }

  canCancelInvitation(user: User): boolean {
    return this.isPendingInvitation(user)
      && !this.isInviting(user)
      && !this.isCancelingInvitation(user);
  }

  canCancelPendingJoinRequest(user: User): boolean {
    return this.isPendingJoinRequest(user)
      && !!this.membershipsByUserId.get(user.id)
      && !this.isInviting(user)
      && !this.isCancelingInvitation(user)
      && !this.isRespondingJoinRequest(user);
  }

  canRespondToJoinRequest(user: User): boolean {
    return this.isPendingJoinRequest(user)
      && !!this.membershipsByUserId.get(user.id)
      && !this.isInviting(user)
      && !this.isCancelingInvitation(user)
      && !this.isRespondingJoinRequest(user);
  }

  canCancelPendingConnection(user: User): boolean {
    return this.canCancelInvitation(user);
  }

  cancelPendingConnection(user: User): void {
    if (this.canCancelInvitation(user)) {
      this.cancelInvitation(user);
    }
  }

  isPendingInvitation(user: User): boolean {
    return isPendingInvitation(this.getInvitationStatus(user));
  }

  isPendingJoinRequest(user: User): boolean {
    return isPendingJoinRequest(this.getInvitationStatus(user));
  }

  isAcceptedMember(user: User): boolean {
    return isAcceptedMember(this.getInvitationStatus(user));
  }

  private hasAnyActiveConnection(user: User): boolean {
    return hasActiveMembershipConnection(this.getInvitationStatus(user));
  }

  private loadInvitationStatuses(): void {
    if (!this.groupId) {
      return;
    }

    this.invitationStatuses.clear();
    this.membershipsByUserId.clear();

    this.groupService.getGroupMemberships(this.groupId).subscribe(
      (memberships) => {
        memberships.forEach((membership) => {
          if (membership.userId && membership.status !== MembershipStatus.Declined) {
            this.invitationStatuses.set(membership.userId, membership.status);
            this.membershipsByUserId.set(membership.userId, membership);
          }
        });
      },
      (error) => {
        console.error('Error loading group memberships:', error);
      },
    );
  }

  private loadInviteUsers(query: string = ''): void {
    this.isLoadingInviteUsers = true;

    this.userService.searchUsers(query).subscribe(
      (users) => {
        this.inviteUsers = query.trim() ? users : this.pickInitialUsers(users);
        this.isLoadingInviteUsers = false;
      },
      (error) => {
        this.isLoadingInviteUsers = false;
        this.inviteModalError = this.languageService.translate('usersLoadError');
        console.error('Error loading invite users:', error);
      },
    );
  }

  private pickInitialUsers(users: User[]): User[] {
    return [...users]
      .sort(() => Math.random() - 0.5)
      .slice(0, 8);
  }

  private getInvitationStatus(user: User): MembershipStatus | undefined {
    return user.id ? this.invitationStatuses.get(user.id) : undefined;
  }

  private resetModalState(): void {
    this.inviteSearchQuery = '';
    this.inviteUsers = [];
    this.isLoadingInviteUsers = false;
    this.invitationStatuses.clear();
    this.membershipsByUserId.clear();
    this.invitingUserIds.clear();
    this.cancelingInvitationUserIds.clear();
    this.respondingJoinRequestUserIds.clear();
    this.inviteModalMessage = '';
    this.inviteModalError = '';
  }
}
