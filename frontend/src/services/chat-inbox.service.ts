import { Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { ChatInboxItem } from '../app/interfaces/chat-inbox-item.model';
import { GroupChatNotification } from '../app/interfaces/group-chat-notification.model';
import { PrivateChatNotification } from '../app/interfaces/private-chat-notification.model';
import { formatGroupPreviewText } from '../app/helpers/chat-list.helper';
import { GroupChatNotificationService } from './group-chat-notification.service';
import { PrivateChatNotificationService } from './private-chat-notification.service';
import { LanguageService } from './language.service';

@Injectable({
  providedIn: 'root',
})
export class ChatInboxService {
  private readonly reactionOverlaysByKey = new Map<string, ChatInboxItem>();

  constructor(
    private groupChatNotificationService: GroupChatNotificationService,
    private privateChatNotificationService: PrivateChatNotificationService,
    private languageService: LanguageService,
  ) {}

  recordReactionOverlay(key: string, item: ChatInboxItem): void {
    this.reactionOverlaysByKey.set(key, item);
  }

  getReactionOverlays(): Map<string, ChatInboxItem> {
    return this.reactionOverlaysByKey;
  }

  getInboxItems(currentUserId: string | null): Observable<ChatInboxItem[]> {
    return forkJoin({
      groupItems: this.groupChatNotificationService.getChatNotifications(),
      privateItems: this.privateChatNotificationService.getChatNotifications(),
    }).pipe(
      map(({ groupItems, privateItems }) => {
        return [
          ...groupItems.map((message) => this.toGroupInboxItem(message, currentUserId)),
          ...privateItems.map((message) => this.toPrivateInboxItem(message)),
        ].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
      }),
    );
  }

  getUnreadCount(): Observable<number> {
    return forkJoin({
      groupUnread: this.groupChatNotificationService.getUnreadCount(),
      privateUnread: this.privateChatNotificationService.getUnreadCount(),
    }).pipe(
      map(({ groupUnread, privateUnread }) => groupUnread.count + privateUnread.count),
    );
  }

  private toGroupInboxItem(message: GroupChatNotification, currentUserId: string | null): ChatInboxItem {
    return {
      type: 'group',
      id: message.groupId,
      title: message.groupName,
      preview: formatGroupPreviewText(
        message.senderUserId,
        message.senderName,
        message.latestMessagePreview,
        currentUserId,
        (key) => this.languageService.translate(key),
      ),
      createdAt: message.createdAt,
      unreadCount: message.unreadCount,
      isRead: message.isRead,
      imageUrl: message.groupImageUrl,
      fallbackIcon: 'bi-people',
      groupId: message.groupId,
    };
  }

  private toPrivateInboxItem(message: PrivateChatNotification): ChatInboxItem {
    return {
      type: 'private',
      id: message.conversationId,
      title: message.otherFullName || message.otherUsername,
      otherUserId: message.otherUserId,
      preview: message.latestMessagePreview,
      createdAt: message.createdAt,
      unreadCount: message.unreadCount,
      isRead: message.isRead,
      imageUrl: message.otherProfilePictureUrl,
      fallbackIcon: 'bi-person',
      conversationId: message.conversationId,
    };
  }
}
