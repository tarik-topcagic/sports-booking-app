import { NgClass, NgFor, NgIf } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ChatRealtimeService } from '../../services/chat-realtime.service';
import { ChatInboxService } from '../../services/chat-inbox.service';
import { DropdownCoordinatorService } from '../../services/dropdown-coordinator.service';
import { GroupChatNotificationService } from '../../services/group-chat-notification.service';
import { PresenceService } from '../../services/presence.service';
import { PrivateChatNotificationService } from '../../services/private-chat-notification.service';
import {
  buildNotificationPreviewText,
  createGroupChatListItemFromNotification,
  createPrivateChatListItemFromNotification,
  formatGroupPreviewText,
  getChatListItemKey,
  mergeInboxItemsWithReactionOverlays,
} from '../helpers/chat-list.helper';
import { LanguageService } from '../../services/language.service';
import {
  applyChatListPresenceUpdate,
  planChatListPresenceSync,
  shouldShowChatListPresenceDot as shouldShowChatListPresenceDotHelper,
} from '../helpers/chat-list-presence.helper';
import {
  clearDropdownTimer,
  createHighlightedSet,
  incrementIf,
  isDropdownActiveForViewport,
  moveItemToTop,
  prependIfNotExists,
  startDropdownTimer,
} from '../helpers/dropdown-ui.helper';
import { getUserIdFromToken } from '../helpers/jwt.helper';
import { ChatMessageNotification } from '../interfaces/chat-message-notification.model';
import { ChatMessageDeletedEvent } from '../interfaces/chat-message-mutation-event.model';
import { ChatInboxItem } from '../interfaces/chat-inbox-item.model';
import { TranslatePipe } from '../pipes/translate.pipe';
import { RelativeTimePipe } from '../pipes/relative-time.pipe';
import { SkeletonListItemComponent } from '../skeleton/skeleton-list-item/skeleton-list-item.component';

@Component({
  selector: 'app-message-dropdown',
  imports: [NgIf, NgFor, NgClass, RouterModule, TranslatePipe, RelativeTimePipe, SkeletonListItemComponent],
  templateUrl: './message-dropdown.component.html',
  styleUrl: './message-dropdown.component.scss',
})
export class MessageDropdownComponent implements OnInit, OnDestroy {
  @Input() mode: 'desktop' | 'mobile' = 'desktop';
  @Output() opened = new EventEmitter<void>();

  username: string | null = null;
  isOpen = false;
  isLoading = false;
  messages: ChatInboxItem[] = [];
  unreadCount = 0;
  highlightedMessageKeys = new Set<string>();

  private currentUserSubscription?: Subscription;
  private routeSubscription?: Subscription;
  private unreadCountSubscription?: Subscription;
  private privateUnreadCountSubscription?: Subscription;
  private realtimeNotificationSubscription?: Subscription;
  private realtimeGroupMessageDeletedSubscription?: Subscription;
  private realtimePrivateMessageDeletedSubscription?: Subscription;
  private presenceSubscription?: Subscription;
  private coordinatorSubscription?: Subscription;
  private readonly refreshIntervalMs = 30000;
  private refreshIntervalId?: ReturnType<typeof setInterval>;
  private readonly desktopMediaQuery = window.matchMedia('(min-width: 992px)');
  private readonly onViewportChange = () => this.syncViewportActivity();
  private isActiveForViewport = false;
  private currentGroupId: number | null = null;
  private currentConversationId: number | null = null;
  private currentUserId: string | null = null;
  private joinedGroupIds = new Set<number>();
  private joinedConversationIds = new Set<number>();
  private privatePresenceByUserId = new Map<string, boolean>();
  private groupPresenceByGroupId = new Map<number, boolean>();
  private loadingPrivatePresenceUserIds = new Set<string>();
  private loadingGroupPresenceIds = new Set<number>();
  private privatePresenceRequestVersions = new Map<string, number>();
  private groupPresenceRequestVersions = new Map<number, number>();

  constructor(
    private authService: AuthService,
    private chatRealtimeService: ChatRealtimeService,
    private chatInboxService: ChatInboxService,
    private groupChatNotificationService: GroupChatNotificationService,
    private privateChatNotificationService: PrivateChatNotificationService,
    private presenceService: PresenceService,
    private router: Router,
    private languageService: LanguageService,
    private elementRef: ElementRef<HTMLElement>,
    private dropdownCoordinator: DropdownCoordinatorService,
  ) {
    this.coordinatorSubscription = this.dropdownCoordinator.activeChanged$.subscribe((activeId) => {
      if (activeId !== this && this.isOpen) {
        this.closeMessages();
      }
    });
  }

  ngOnInit(): void {
    this.currentUserSubscription = this.authService.currentUser.subscribe((user) => {
      this.username = user ? user.username : null;
      this.currentUserId = user?.token ? getUserIdFromToken(user.token) : null;

      if (this.username && this.isActiveForViewport) {
        void this.refreshViewportData();
        return;
      }

      if (!this.username) {
        this.resetState();
      }
    });

    this.realtimeNotificationSubscription = this.chatRealtimeService.incomingMessageNotifications$.subscribe((notification) => {
      if (this.username && this.isActiveForViewport) {
        this.applyRealtimeNotification(notification);
      }
    });

    this.routeSubscription = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.syncCurrentChatContext(this.router.url);
      });

    this.presenceSubscription = this.presenceService.presenceUpdates$.subscribe((update) => {
      this.applyPresenceUpdate(update.userId, update.isOnline);
    });

    this.realtimeGroupMessageDeletedSubscription = this.chatRealtimeService.incomingGroupMessageDeleted$.subscribe((event) => {
      this.applyMessageDeletedToChatListItem('group', event.groupId, event);
    });

    this.realtimePrivateMessageDeletedSubscription = this.chatRealtimeService.incomingPrivateMessageDeleted$.subscribe((event) => {
      this.applyMessageDeletedToChatListItem('private', event.conversationId, event);
    });

    this.syncCurrentChatContext(this.router.url);

    this.unreadCountSubscription = this.groupChatNotificationService.unreadCountRefresh$.subscribe(() => {
      if (this.username && this.isActiveForViewport) {
        this.loadUnreadCount();
        this.loadMessages();
      }
    });

    this.privateUnreadCountSubscription = this.privateChatNotificationService.unreadCountRefresh$.subscribe(() => {
      if (this.username && this.isActiveForViewport) {
        this.loadUnreadCount();
        this.loadMessages();
      }
    });

    this.desktopMediaQuery.addEventListener('change', this.onViewportChange);
    this.syncViewportActivity();
  }

  ngOnDestroy(): void {
    this.currentUserSubscription?.unsubscribe();
    this.routeSubscription?.unsubscribe();
    this.unreadCountSubscription?.unsubscribe();
    this.privateUnreadCountSubscription?.unsubscribe();
    this.realtimeNotificationSubscription?.unsubscribe();
    this.realtimeGroupMessageDeletedSubscription?.unsubscribe();
    this.realtimePrivateMessageDeletedSubscription?.unsubscribe();
    this.presenceSubscription?.unsubscribe();
    this.coordinatorSubscription?.unsubscribe();
    this.dropdownCoordinator.close(this);
    this.desktopMediaQuery.removeEventListener('change', this.onViewportChange);
    this.stopTimers();

    if (this.isActiveForViewport) {
      void this.chatRealtimeService.disconnect();
    }
  }

  toggleMessages(): void {
    if (this.mode === 'mobile') {
      this.router.navigate(['/messages']);
      return;
    }

    if (this.isOpen) {
      this.closeMessages();
      return;
    }

    this.dropdownCoordinator.open(this, this.elementRef.nativeElement);
    this.isOpen = true;
    this.opened.emit();
    this.loadMessages(true);
  }

  openMessage(message: ChatInboxItem): void {
    if (message.type === 'group' && message.groupId) {
      this.groupChatNotificationService.markGroupAsRead(message.groupId).subscribe({
        next: () => {
          message.isRead = true;
          message.unreadCount = 0;
          this.groupChatNotificationService.notifyUnreadCountChanged();
          this.router.navigate(['/groups', message.groupId, 'chat']);
          this.closeMessages();
        },
        error: () => {
          this.router.navigate(['/groups', message.groupId, 'chat']);
          this.closeMessages();
        },
      });
      return;
    }

    if (message.type === 'private' && message.conversationId) {
      this.privateChatNotificationService.markConversationAsRead(message.conversationId).subscribe({
        next: () => {
          message.isRead = true;
          message.unreadCount = 0;
          this.privateChatNotificationService.notifyUnreadCountChanged();
          this.router.navigate(['/messages/private', message.conversationId]);
          this.closeMessages();
        },
        error: () => {
          this.router.navigate(['/messages/private', message.conversationId]);
          this.closeMessages();
        },
      });
    }
  }

  private applyMessageDeletedToChatListItem(type: 'group' | 'private', id: number | null, event: ChatMessageDeletedEvent): void {
    if (id === null) {
      return;
    }

    const targetItem = this.messages.find((item) =>
      type === 'group' ? item.type === 'group' && item.groupId === id : item.type === 'private' && item.conversationId === id,
    );

    if (!targetItem) {
      return;
    }
    
    const wasUnread = targetItem.unreadCount > 0;
    const nextUnreadCount = wasUnread ? targetItem.unreadCount - 1 : targetItem.unreadCount;
    const targetKey = getChatListItemKey(targetItem);

    const updatedItem: ChatInboxItem = event.isChatNowEmpty
      ? {
          ...targetItem,
          preview: this.languageService.translate(type === 'group' ? 'noGroupMessages' : 'noPrivateMessages'),
          unreadCount: nextUnreadCount,
          isRead: nextUnreadCount === 0,
        }
      : {
          ...targetItem,
          preview:
            type === 'group' && event.updatedPreviewText && event.updatedPreviewSenderUserId && event.updatedPreviewSenderName
              ? formatGroupPreviewText(
                  event.updatedPreviewSenderUserId,
                  event.updatedPreviewSenderName,
                  event.updatedPreviewText,
                  this.currentUserId,
                  (key) => this.languageService.translate(key),
                )
              : (event.updatedPreviewText ?? targetItem.preview),
          createdAt: event.updatedPreviewCreatedAt ?? targetItem.createdAt,
          unreadCount: nextUnreadCount,
          isRead: nextUnreadCount === 0,
        };

    this.messages = this.messages.map((item) => (item === targetItem ? updatedItem : item));

    if (wasUnread) {
      this.unreadCount = Math.max(0, this.unreadCount - 1);

      if (nextUnreadCount === 0) {
        this.highlightedMessageKeys.delete(targetKey);
      }
    }
  }

  hasUnreadMessages(message: ChatInboxItem): boolean {
    return message.unreadCount > 0;
  }

  isHighlightedMessage(message: ChatInboxItem): boolean {
    return this.highlightedMessageKeys.has(getChatListItemKey(message));
  }

  shouldShowPresenceDot(message: ChatInboxItem): boolean {
    const shouldShowKnownPresence = shouldShowChatListPresenceDotHelper(
      message,
      this.currentUserId,
      this.privatePresenceByUserId,
      this.groupPresenceByGroupId,
    );

    if (shouldShowKnownPresence) {
      return true;
    }

    if (message.type === 'group' && !!message.groupId) {
      return this.loadingGroupPresenceIds.has(message.groupId) && !!this.currentUserId;
    }

    if (message.type === 'private' && !!message.otherUserId) {
      return this.loadingPrivatePresenceUserIds.has(message.otherUserId)
        && this.privatePresenceByUserId.get(message.otherUserId) === true;
    }

    return false;
  }

  private syncViewportActivity(): void {
    const shouldBeActive = isDropdownActiveForViewport(this.mode, this.desktopMediaQuery);

    if (shouldBeActive === this.isActiveForViewport) {
      return;
    }

    this.isActiveForViewport = shouldBeActive;

    if (shouldBeActive) {
      this.startTimers();
      void this.refreshViewportData();

      return;
    }

    this.stopTimers();
    this.leaveTrackedRooms();
    void this.chatRealtimeService.disconnect();
    this.closeMessages();
  }

  private startTimers(): void {
    this.stopTimers();

    this.refreshIntervalId = startDropdownTimer(() => {
      if (!this.username) {
        return;
      }

      void this.refreshViewportData();
    }, this.refreshIntervalMs);
  }

  private stopTimers(): void {
    this.refreshIntervalId = clearDropdownTimer(this.refreshIntervalId);
  }

  private loadMessages(captureUnreadHighlights = false): void {
    if (!this.username || !this.isActiveForViewport) {
      return;
    }

    if (!this.messages.length) {
      this.isLoading = true;
    }

    this.chatInboxService.getInboxItems(this.currentUserId).subscribe({
      next: (messages) => {
        this.isLoading = false;

        const mergedMessages = mergeInboxItemsWithReactionOverlays(messages, this.chatInboxService.getReactionOverlays());

        if (captureUnreadHighlights) {
          this.highlightedMessageKeys = createHighlightedSet(
            mergedMessages,
            (message) => message.unreadCount > 0,
            (message) => getChatListItemKey(message),
          );
        }

        this.messages = mergedMessages;
        void this.syncRealtimeRooms(mergedMessages);
        this.syncPresenceIndicators(mergedMessages);
      },
      error: (error) => {
        this.isLoading = false;
        console.error('Error loading chat inbox notifications:', error);
      },
    });
  }

  private loadUnreadCount(): void {
    if (!this.username || !this.isActiveForViewport) {
      return;
    }

    this.chatInboxService.getUnreadCount().subscribe({
      next: (count) => {
        this.unreadCount = count;
      },
      error: (error) => {
        console.error('Error loading unread chat inbox count:', error);
      },
    });
  }

  private closeMessages(): void {
    this.isOpen = false;
    this.highlightedMessageKeys.clear();
    this.dropdownCoordinator.close(this);
  }

  private resetState(): void {
    this.messages = [];
    this.unreadCount = 0;
    this.isLoading = false;
    this.highlightedMessageKeys.clear();
    this.privatePresenceByUserId.clear();
    this.groupPresenceByGroupId.clear();
    this.loadingPrivatePresenceUserIds.clear();
    this.loadingGroupPresenceIds.clear();
    this.leaveTrackedRooms();
    this.closeMessages();
  }

  private async syncRealtimeRooms(messages: ChatInboxItem[]): Promise<void> {
    const nextGroupIds = new Set(messages.filter((message) => message.type === 'group' && !!message.groupId).map((message) => message.groupId as number));
    const nextConversationIds = new Set(messages.filter((message) => message.type === 'private' && !!message.conversationId).map((message) => message.conversationId as number));

    for (const groupId of this.joinedGroupIds) {
      if (!nextGroupIds.has(groupId)) {
        await this.chatRealtimeService.leaveGroup(groupId);
      }
    }

    for (const conversationId of this.joinedConversationIds) {
      if (!nextConversationIds.has(conversationId)) {
        await this.chatRealtimeService.leaveConversation(conversationId);
      }
    }

    for (const groupId of nextGroupIds) {
      if (!this.joinedGroupIds.has(groupId)) {
        await this.chatRealtimeService.joinGroup(groupId);
      }
    }

    for (const conversationId of nextConversationIds) {
      if (!this.joinedConversationIds.has(conversationId)) {
        await this.chatRealtimeService.joinConversation(conversationId);
      }
    }

    this.joinedGroupIds = nextGroupIds;
    this.joinedConversationIds = nextConversationIds;
  }

  private leaveTrackedRooms(): void {
    for (const groupId of this.joinedGroupIds) {
      void this.chatRealtimeService.leaveGroup(groupId);
    }

    for (const conversationId of this.joinedConversationIds) {
      void this.chatRealtimeService.leaveConversation(conversationId);
    }

    this.joinedGroupIds.clear();
    this.joinedConversationIds.clear();
  }

  private applyRealtimeNotification(notification: ChatMessageNotification): void {
    const existingMessage = this.messages.find((message) => {
      return notification.type === 'group'
        ? message.type === 'group' && message.groupId === notification.groupId
        : message.type === 'private' && message.conversationId === notification.conversationId;
    });

    const shouldIncrementUnread = this.shouldIncrementUnread(notification);

    if (!existingMessage) {
      const newMessage = this.createInboxItemFromNotification(notification, shouldIncrementUnread);
      this.messages = prependIfNotExists(
        this.messages,
        newMessage,
        (message) => getChatListItemKey(message) === getChatListItemKey(newMessage),
      );

      if (notification.kind === 'reaction') {
        this.chatInboxService.recordReactionOverlay(getChatListItemKey(newMessage), newMessage);
      }

      if (shouldIncrementUnread) {
        this.unreadCount = incrementIf(this.unreadCount, true);
        this.highlightedMessageKeys.add(getChatListItemKey(newMessage));
      }

      void this.syncRealtimeRooms(this.messages);
      this.syncPresenceIndicators(this.messages);

      return;
    }

    const updatedMessage: ChatInboxItem = {
      ...existingMessage,
      preview: buildNotificationPreviewText(notification, this.currentUserId, (key) => this.languageService.translate(key)),
      createdAt: notification.createdAt,
      isRead: !shouldIncrementUnread,
      unreadCount: shouldIncrementUnread ? existingMessage.unreadCount + 1 : existingMessage.unreadCount,
    };

    if (notification.kind === 'reaction') {
      this.chatInboxService.recordReactionOverlay(getChatListItemKey(updatedMessage), updatedMessage);
    }

    this.messages = moveItemToTop(
      this.messages,
      updatedMessage,
      (message) => getChatListItemKey(message) === getChatListItemKey(existingMessage),
    );

    if (shouldIncrementUnread) {
      this.unreadCount = incrementIf(this.unreadCount, true);
      this.highlightedMessageKeys.add(getChatListItemKey(updatedMessage));
    }
  }

  private shouldIncrementUnread(notification: ChatMessageNotification): boolean {
    if (notification.senderUserId === this.currentUserId) {
      return false;
    }

    if (notification.type === 'group' && notification.groupId && this.currentGroupId === notification.groupId) {
      return false;
    }

    if (notification.type === 'private' && notification.conversationId && this.currentConversationId === notification.conversationId) {
      return false;
    }

    return true;
  }

  private createInboxItemFromNotification(
    notification: ChatMessageNotification,
    shouldIncrementUnread: boolean,
  ): ChatInboxItem {
    return notification.type === 'group'
      ? createGroupChatListItemFromNotification(
          notification,
          shouldIncrementUnread,
          null,
          this.currentUserId,
          (key) => this.languageService.translate(key),
        )
      : createPrivateChatListItemFromNotification(notification, shouldIncrementUnread, null);
  }

  private syncPresenceIndicators(messages: ChatInboxItem[]): void {
    const syncPlan = planChatListPresenceSync(
      messages,
      this.currentUserId,
      this.privatePresenceByUserId,
      this.groupPresenceByGroupId,
    );

    for (const userId of syncPlan.stalePrivateUserIds) {
      this.privatePresenceByUserId.delete(userId);
      this.loadingPrivatePresenceUserIds.delete(userId);
    }

    for (const groupId of syncPlan.staleGroupIds) {
      this.groupPresenceByGroupId.delete(groupId);
      this.loadingGroupPresenceIds.delete(groupId);
    }

    for (const userId of syncPlan.missingPrivateUserIds) {
      this.loadPrivatePresence(userId);
    }

    for (const groupId of syncPlan.missingGroupIds) {
      if (this.currentUserId) {
        this.groupPresenceByGroupId.set(groupId, true);
      }
      this.loadGroupPresence(groupId);
    }
  }

  private loadPrivatePresence(userId: string): void {
    if (this.loadingPrivatePresenceUserIds.has(userId)) {
      return;
    }

    const requestVersion = (this.privatePresenceRequestVersions.get(userId) ?? 0) + 1;
    this.privatePresenceRequestVersions.set(userId, requestVersion);
    this.loadingPrivatePresenceUserIds.add(userId);

    this.presenceService.getUserPresence(userId).subscribe({
      next: (presence) => {
        if (this.privatePresenceRequestVersions.get(userId) !== requestVersion) {
          return;
        }

        this.loadingPrivatePresenceUserIds.delete(userId);
        this.privatePresenceByUserId.set(userId, presence.isOnline);
      },
      error: () => {
        if (this.privatePresenceRequestVersions.get(userId) !== requestVersion) {
          return;
        }

        this.loadingPrivatePresenceUserIds.delete(userId);
        this.privatePresenceByUserId.set(userId, false);
      },
    });
  }

  private loadGroupPresence(groupId: number): void {
    if (this.loadingGroupPresenceIds.has(groupId)) {
      return;
    }

    const requestVersion = (this.groupPresenceRequestVersions.get(groupId) ?? 0) + 1;
    this.groupPresenceRequestVersions.set(groupId, requestVersion);
    this.loadingGroupPresenceIds.add(groupId);

    this.presenceService.getGroupPresence(groupId).subscribe({
      next: (presence) => {
        if (this.groupPresenceRequestVersions.get(groupId) !== requestVersion) {
          return;
        }

        this.loadingGroupPresenceIds.delete(groupId);
        this.groupPresenceByGroupId.set(groupId, presence.onlineUserIds.length > 0);
      },
      error: () => {
        if (this.groupPresenceRequestVersions.get(groupId) !== requestVersion) {
          return;
        }

        this.loadingGroupPresenceIds.delete(groupId);
        this.groupPresenceByGroupId.set(groupId, false);
      },
    });
  }

  private applyPresenceUpdate(userId: string, isOnline: boolean): void {
    const updateResult = applyChatListPresenceUpdate(
      this.messages,
      userId,
      isOnline,
      this.currentUserId,
      this.privatePresenceByUserId,
    );

    this.privatePresenceByUserId = updateResult.nextPrivatePresenceByUserId;

    for (const groupId of updateResult.groupIdsToReload) {
      this.loadGroupPresence(groupId);
    }
  }

  private syncCurrentChatContext(url: string): void {
    const groupMatch = url.match(/^\/groups\/(\d+)\/chat(?:$|[?#])/);
    this.currentGroupId = groupMatch ? Number(groupMatch[1]) : null;

    const conversationMatch = url.match(/^\/messages\/private\/(\d+)(?:$|[?#])/);
    this.currentConversationId = conversationMatch ? Number(conversationMatch[1]) : null;
  }

  private async refreshViewportData(): Promise<void> {
    if (!this.username || !this.isActiveForViewport) {
      return;
    }

    await this.chatRealtimeService.connect();

    if (!this.username || !this.isActiveForViewport) {
      return;
    }

    this.loadUnreadCount();
    this.loadMessages();
  }
}
