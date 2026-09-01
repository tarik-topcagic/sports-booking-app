import { ChatInboxPreviewSource } from './chat-inbox-preview-source.model';

export interface ChatInboxItem {
  type: 'group' | 'private';
  id: number;
  title: string;
  subtitle?: string;
  otherUserId?: string;
  preview: string;
  previewSource?: ChatInboxPreviewSource;
  createdAt: string;
  unreadCount: number;
  isRead: boolean;
  imageUrl?: string | null;
  fallbackIcon: string;
  groupId?: number;
  conversationId?: number;
}
