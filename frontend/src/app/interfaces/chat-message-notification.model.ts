export interface ChatMessageNotification {
  type: 'group' | 'private';
  groupId: number | null;
  groupName: string | null;
  conversationId: number | null;
  senderUserId: string;
  senderName: string;
  preview: string;
  createdAt: string;
  kind?: 'message' | 'reaction';
  reactionEmoji?: string;
  isNewNotification?: boolean;
}
