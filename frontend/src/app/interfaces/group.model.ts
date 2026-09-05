import { ChatMessageSendStatus, MessageReaction } from './message-reaction.model';

export interface Group {
  id: number;
  name: string;
  description: string;
  city: string;
  cityId: number;
  sportCategory: string;
  adminId: string;
  adminDisplayName?: string;
  adminUsername?: string;
  imageUrl: string;
  createdAt: Date;
  dateCreated: Date;
  memberships?: GroupMembership[];
  membersCount?: number; 
}

export interface GroupDetails {
  id: number;
  name: string;
  description: string;
  city: string;
  cityId: number;
  sportCategory: string;
  imageUrl: string;
  adminDisplayName: string;
  currentUserId: string;
  dateCreated: Date;
  membersCount: number;
  isAdmin: boolean;
  isMember: boolean;
  hasPendingJoinRequest: boolean;
  hasPendingInvitation: boolean;
  pendingInvitationMembershipId?: number | null;
  members: GroupMember[];
}

export interface GroupMember {
  userId: string;
  username: string;
  displayName: string;
  profilePictureUrl: string | null;
  isAdmin: boolean;
}

export interface GroupChatMessage {
  id: number;
  groupId: number;
  senderUserId: string;
  senderUsername: string;
  senderFullName: string;
  senderProfilePictureUrl: string | null;
  messageText: string;
  createdAt: Date | string;
  deliveredAt?: Date | string | null;
  seenAt?: Date | string | null;
  seenByUserIds?: string[];
  seenByUserNames?: string[];
  seenByUserProfilePictureUrls?: string[];
  isPinned?: boolean;
  pinnedAt?: Date | string | null;
  replyToMessageId?: number | null;
  replyToSenderUserId?: string | null;
  replyToSenderName?: string | null;
  replyToMessageTextPreview?: string | null;
  replyToIsDeleted?: boolean;
  reactions?: MessageReaction[];
  clientTempId?: string;
  sendStatus?: ChatMessageSendStatus;
}

export interface GroupMembership {
  id: number;
  groupId: number;
  userId: string;
  status: MembershipStatus;
  username?: string;
  fullName?: string;
  createdAt?: Date;
  joinedAt: Date;
  respondedAt?: Date | null;
}

export interface UpdateGroupDto {
  name: string;
  description: string;
  cityId: number;
  sportCategory: string;
  groupPictureUrl?: string | null;
}

export interface GroupMembershipState {
  groupId: number;
  userId: string;
  membershipId: number;
  status: MembershipStatus;
}

export enum MembershipStatus {
  PendingJoinRequest = 'PendingJoinRequest',
  PendingInvitation = 'PendingInvitation',
  Accepted = 'Accepted',
  Declined = 'Declined'
}
