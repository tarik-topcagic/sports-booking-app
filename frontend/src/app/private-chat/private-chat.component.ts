import { NgClass, NgFor, NgIf } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription, catchError, forkJoin, NEVER, of, switchMap, tap, throwError } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ChatRealtimeService } from '../../services/chat-realtime.service';
import { ChatInboxService } from '../../services/chat-inbox.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { LanguageService } from '../../services/language.service';
import { PresenceService } from '../../services/presence.service';
import { PrivateChatService } from '../../services/private-chat.service';
import { PrivateChatNotificationService } from '../../services/private-chat-notification.service';
import { GroupService } from '../../services/group.service';
import {
  appendMessageIfNotExists,
  applyStatusUpdateToMessages,
  mergeStatusUpdates as mergePendingStatusUpdates,
} from '../helpers/chat-status.helper';
import {
  applyRealtimeChatListNotification as applyRealtimeChatListUpdate,
  createChatListHighlightedKeys,
  createGroupChatListItemFromNotification,
  createPrivateChatListItemFromNotification,
  getChatListItemKey,
} from '../helpers/chat-list.helper';
import {
  applyChatListPresenceUpdate,
  planChatListPresenceSync,
  shouldShowChatListPresenceDot as shouldShowChatListPresenceDotHelper,
} from '../helpers/chat-list-presence.helper';
import {
  clearAllTypingEntryExpiries,
  clearTypingEntryExpiry,
  clearTypingTimer,
  scheduleTypingEntryExpiry,
  scheduleTypingTimer,
} from '../helpers/chat-typing.helper';
import { scrollToBottom, shouldShowScrollButton } from '../helpers/chat-ui.helper';
import { getUserIdFromToken } from '../helpers/jwt.helper';
import { ChatInboxItem } from '../interfaces/chat-inbox-item.model';
import {
  ChatMessageDeletedEvent,
  ChatMessagePinStateChangedEvent,
  ChatMessageReactionsChangedEvent,
} from '../interfaces/chat-message-mutation-event.model';
import { ChatMessageNotification } from '../interfaces/chat-message-notification.model';
import { ChatMessageStatusUpdate } from '../interfaces/chat-message-status-update.model';
import { ChatTypingEvent } from '../interfaces/chat-typing-event.model';
import { PrivateConversation, PrivateMessage } from '../interfaces/private-chat.model';
import { UserPresence } from '../interfaces/user-presence.model';
import { Group, GroupDetails } from '../interfaces/group.model';
import { insertTextAtSelection } from '../helpers/chat-input.helper';
import { ChatEmojiPickerComponent } from '../chat-emoji-picker/chat-emoji-picker.component';
import { LongPressDirective } from '../directives/long-press.directive';
import { MessageActionsComponent } from '../message-actions/message-actions.component';
import { TranslatePipe } from '../pipes/translate.pipe';
import { LiveRelativeTimePipe } from '../pipes/live-relative-time.pipe';
import { SkeletonComponent } from '../skeleton/skeleton/skeleton.component';
import { LoadErrorStateComponent } from '../load-error-state/load-error-state.component';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-private-chat',
  imports: [
    NgIf,
    NgFor,
    NgClass,
    FormsModule,
    RouterLink,
    TranslatePipe,
    LiveRelativeTimePipe,
    ChatEmojiPickerComponent,
    SkeletonComponent,
    LongPressDirective,
    MessageActionsComponent,
    LoadErrorStateComponent,
  ],
  templateUrl: './private-chat.component.html',
  styleUrl: './private-chat.component.scss',
})
export class PrivateChatComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('messageInput') private messageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('chatState') chatState!: LoadErrorStateComponent;

  conversation: PrivateConversation | null = null;
  conversations: PrivateConversation[] = [];
  chatListItems: ChatInboxItem[] = [];
  highlightedChatListKeys = new Set<string>();
  messages: PrivateMessage[] = [];
  messageText = '';
  isSending = false;
  readonly skeletonBubbles = [
    { width: '55%', own: false },
    { width: '40%', own: true },
    { width: '65%', own: false },
  ];
  showScrollToBottomButton = false;
  errorMessage = '';
  isOtherUserOnline = false;
  isOtherUserPresenceKnown = false;
  canShowOtherUserPresence = false;
  privateChatListPresenceByUserId = new Map<string, boolean>();
  groupChatListPresenceByGroupId = new Map<number, boolean>();
  replyTarget: PrivateMessage | null = null;
  relativeTimeRefreshKey = 0;
  private readonly relativeTimeRefreshIntervalMs = 60000;
  private relativeTimeRefreshIntervalId?: ReturnType<typeof setInterval>;
  private currentUserId: string | null = null;
  private isInitialRouteParamsEmission = true;
  private currentUserSubscription?: Subscription;
  private routeSubscription?: Subscription;
  private realtimeMessageSubscription?: Subscription;
  private realtimeNotificationSubscription?: Subscription;
  private realtimeStatusSubscription?: Subscription;
  private realtimeTypingSubscription?: Subscription;
  private realtimeStopTypingSubscription?: Subscription;
  private realtimeMessageDeletedSubscription?: Subscription;
  private realtimeMessagePinStateChangedSubscription?: Subscription;
  private realtimeMessageReactionsChangedSubscription?: Subscription;
  private realtimeReconnectedSubscription?: Subscription;
  private presenceSubscription?: Subscription;
  private readonly onConnectionRestored = () => this.retryFailedMessages();
  private connectedConversationId: number | null = null;
  private pendingStatusUpdates = new Map<number, ChatMessageStatusUpdate>();
  private readonly typingUsers = new Map<string, string>();
  private readonly typingEntryExpiryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private typingStartTimeoutId?: ReturnType<typeof setTimeout>;
  private typingStopTimeoutId?: ReturnType<typeof setTimeout>;
  private isTypingActive = false;
  private messageSelectionStart: number | null = null;
  private messageSelectionEnd: number | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private chatRealtimeService: ChatRealtimeService,
    private chatInboxService: ChatInboxService,
    private privateChatService: PrivateChatService,
    private privateChatNotificationService: PrivateChatNotificationService,
    private languageService: LanguageService,
    private presenceService: PresenceService,
    private groupService: GroupService,
    private toastService: ToastService,
    private confirmDialogService: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    void this.chatRealtimeService.connect();

    this.currentUserSubscription = this.authService.currentUser.subscribe((user) => {
      this.currentUserId = user?.token ? getUserIdFromToken(user.token) : null;
    });

    this.realtimeMessageSubscription = this.chatRealtimeService.incomingPrivateMessages$.subscribe((message) => {
      this.handleIncomingRealtimeMessage(message);
    });

    this.realtimeNotificationSubscription = this.chatRealtimeService.incomingMessageNotifications$.subscribe((notification) => {
      this.applyRealtimeChatListNotification(notification);
    });

    this.realtimeStatusSubscription = this.chatRealtimeService.incomingMessageStatusUpdates$.subscribe((update) => {
      this.handleStatusUpdate(update);
    });

    this.realtimeTypingSubscription = this.chatRealtimeService.incomingTyping$.subscribe((event) => {
      this.handleTypingEvent(event);
    });

    this.realtimeStopTypingSubscription = this.chatRealtimeService.incomingStopTyping$.subscribe((event) => {
      this.handleStopTypingEvent(event);
    });

    this.realtimeMessageDeletedSubscription = this.chatRealtimeService.incomingPrivateMessageDeleted$.subscribe((event) => {
      this.handleMessageDeleted(event);
    });

    this.realtimeMessagePinStateChangedSubscription = this.chatRealtimeService.incomingPrivateMessagePinStateChanged$.subscribe((event) => {
      this.handleMessagePinStateChanged(event);
    });

    this.realtimeMessageReactionsChangedSubscription = this.chatRealtimeService.incomingPrivateMessageReactionsChanged$.subscribe((event) => {
      this.handleMessageReactionsChanged(event);
    });

    this.realtimeReconnectedSubscription = this.chatRealtimeService.reconnected$.subscribe(() => {
      this.retryFailedMessages();
    });

    window.addEventListener('online', this.onConnectionRestored);

    this.presenceSubscription = this.presenceService.presenceUpdates$.subscribe((update) => {
      this.handlePresenceUpdate(update);
    });

    this.routeSubscription = this.route.paramMap.subscribe((params) => {
      const conversationId = Number(params.get('conversationId'));
      const targetUserId = params.get('userId');

      if (!conversationId && !targetUserId) {
        this.router.navigate(['/messages']);
        return;
      }

      if (this.isInitialRouteParamsEmission) {
        this.isInitialRouteParamsEmission = false;
        if (conversationId) {
          void this.setupRealtime(conversationId);
        }
        return;
      }

      this.resetViewState();

      if (conversationId) {
        void this.setupRealtime(conversationId).then(() => this.chatState.reload());
        return;
      }

      this.chatState.reload();
    });

    this.relativeTimeRefreshIntervalId = setInterval(() => {
      this.relativeTimeRefreshKey += 1;
    }, this.relativeTimeRefreshIntervalMs);
  }

  ngAfterViewInit(): void {
    this.scrollMessagesToBottom();
  }

  ngOnDestroy(): void {
    this.currentUserSubscription?.unsubscribe();
    this.routeSubscription?.unsubscribe();
    this.realtimeMessageSubscription?.unsubscribe();
    this.realtimeNotificationSubscription?.unsubscribe();
    this.realtimeStatusSubscription?.unsubscribe();
    this.realtimeTypingSubscription?.unsubscribe();
    this.realtimeStopTypingSubscription?.unsubscribe();
    this.realtimeMessageDeletedSubscription?.unsubscribe();
    this.realtimeMessagePinStateChangedSubscription?.unsubscribe();
    this.realtimeMessageReactionsChangedSubscription?.unsubscribe();
    this.realtimeReconnectedSubscription?.unsubscribe();
    window.removeEventListener('online', this.onConnectionRestored);
    this.presenceSubscription?.unsubscribe();

    if (this.relativeTimeRefreshIntervalId) {
      clearInterval(this.relativeTimeRefreshIntervalId);
    }

    this.stopTypingLocally();
    clearAllTypingEntryExpiries(this.typingEntryExpiryTimers);
    if (this.connectedConversationId !== null) {
      void this.chatRealtimeService.leaveConversation(this.connectedConversationId);
    }
    void this.chatRealtimeService.disconnect();
  }

  sendMessage(): void {
    const trimmedMessage = this.messageText.trim();
    if (!this.conversation?.id || !trimmedMessage || this.isSending) {
      return;
    }

    this.stopTypingLocally();
    this.isSending = true;

    const conversationId = this.conversation.id;
    const replyTarget = this.replyTarget;
    const clientTempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const optimisticMessage: PrivateMessage = {
      id: -Date.now(),
      conversationId,
      senderUserId: this.currentUserId ?? '',
      senderUsername: this.authService.currentUserValue?.username ?? '',
      senderFullName: this.authService.currentUserValue?.fullName || this.authService.currentUserValue?.username || '',
      senderProfilePictureUrl: null,
      messageText: trimmedMessage,
      createdAt: new Date(),
      replyToMessageId: replyTarget?.id ?? null,
      replyToSenderName: replyTarget?.senderFullName ?? null,
      replyToMessageTextPreview: replyTarget?.messageText ?? null,
      replyToIsDeleted: false,
      reactions: [],
      clientTempId,
      sendStatus: 'sending',
    };

    this.messages = [...this.messages, optimisticMessage];
    this.messageText = '';
    this.cancelReply();
    this.scrollMessagesToBottom('smooth');

    this.privateChatService.sendMessageToConversation(conversationId, trimmedMessage, replyTarget?.id ?? null).subscribe({
      next: (message) => {
        this.isSending = false;
        this.messages = this.messages.map((existingMessage) =>
          existingMessage.clientTempId === clientTempId ? message : existingMessage,
        );
      },
      error: (error) => {
        this.isSending = false;
        this.messages = this.messages.map((existingMessage) =>
          existingMessage.clientTempId === clientTempId
            ? { ...existingMessage, sendStatus: 'failed' as const }
            : existingMessage,
        );
        this.toastService.showError(this.languageService.translate('privateChatSendError'));
        console.error('Error sending private chat message:', error);
      },
    });
  }

  isOwnMessage(message: PrivateMessage): boolean {
    return message.senderUserId !== this.conversation?.otherUserId;
  }

  isMessageFailed(message: PrivateMessage): boolean {
    return message.sendStatus === 'failed';
  }

  isFirstInSenderRun(index: number): boolean {
    return index === 0 || this.messages[index - 1].senderUserId !== this.messages[index].senderUserId;
  }

  getDisplayName(senderUserId: string | null | undefined, senderName: string | null | undefined): string {
    if (!senderName) {
      return '';
    }

    return senderUserId === this.currentUserId ? this.languageService.translate('you') : senderName;
  }

  startReply(message: PrivateMessage): void {
    this.replyTarget = message;
    this.messageInput?.nativeElement.focus();
  }

  cancelReply(): void {
    this.replyTarget = null;
  }

  private swipingMessageId: number | null = null;
  private swipeOffsetPx = 0;

  isSwiping(message: PrivateMessage): boolean {
    return this.swipingMessageId === message.id;
  }

  getSwipeOffset(message: PrivateMessage): number {
    return this.swipingMessageId === message.id ? this.swipeOffsetPx : 0;
  }

  onSwipeProgress(message: PrivateMessage, deltaPx: number): void {
    this.swipingMessageId = message.id;
    this.swipeOffsetPx = this.isOwnMessage(message) ? Math.min(0, deltaPx) : Math.max(0, deltaPx);
  }

  onSwipeCompleted(message: PrivateMessage, direction: 'left' | 'right'): void {
    const expectedDirection = this.isOwnMessage(message) ? 'left' : 'right';

    if (direction === expectedDirection) {
      this.startReply(message);
    }

    this.swipingMessageId = null;
    this.swipeOffsetPx = 0;
  }

  onSwipeCancelled(): void {
    this.swipingMessageId = null;
    this.swipeOffsetPx = 0;
  }

  copyMessageText(message: PrivateMessage): void {
    navigator.clipboard.writeText(message.messageText).then(
      () => this.toastService.showSuccess(this.languageService.translate('messageCopied')),
      () => this.toastService.showError(this.languageService.translate('messageCopyError')),
    );
  }

  async requestUnsend(message: PrivateMessage): Promise<void> {
    if (!this.conversation?.id) {
      return;
    }

    const confirmed = await this.confirmDialogService.confirm('confirmUnsendMessage');
    if (!confirmed) {
      return;
    }

    this.privateChatService.deletePrivateMessage(this.conversation.id, message.id).subscribe({
      error: (error) => {
        this.toastService.showError(this.languageService.translate('unsendMessageError'));
        console.error('Error unsending private chat message:', error);
      },
    });
  }

  requestPin(message: PrivateMessage): void {
    if (!this.conversation?.id) {
      return;
    }

    this.privateChatService.setPrivateMessagePinned(this.conversation.id, message.id, !message.isPinned).subscribe({
      error: (error) => {
        this.toastService.showError(this.languageService.translate('pinMessageError'));
        console.error('Error pinning private chat message:', error);
      },
    });
  }

  onBubbleDoubleClick(event: MouseEvent, message: PrivateMessage): void {
    if (this.isMessageFailed(message)) {
      return;
    }

    event.preventDefault();
    this.reactToMessage(message, '❤️');
  }

  reactToMessage(message: PrivateMessage, emoji: string): void {
    if (!this.conversation?.id) {
      return;
    }

    const existingEmoji = this.getCurrentUserReactionEmoji(message);
    const request$ = existingEmoji === emoji
      ? this.privateChatService.removePrivateMessageReaction(this.conversation.id, message.id)
      : this.privateChatService.addOrUpdatePrivateMessageReaction(this.conversation.id, message.id, emoji);

    request$.subscribe({
      error: (error) => {
        this.toastService.showError(this.languageService.translate('reactToMessageError'));
        console.error('Error reacting to private chat message:', error);
      },
    });
  }

  getCurrentUserReactionEmoji(message: PrivateMessage): string | null {
    return message.reactions?.find((reaction) => reaction.userId === this.currentUserId)?.emoji ?? null;
  }

  getGroupedReactions(message: PrivateMessage): { emoji: string; count: number; userNames: string; isOwnReaction: boolean }[] {
    const groups = new Map<string, string[]>();
    const userIds = new Map<string, string[]>();

    for (const reaction of message.reactions ?? []) {
      const userNames = groups.get(reaction.emoji) ?? [];
      userNames.push(reaction.userName);
      groups.set(reaction.emoji, userNames);

      const reactionUserIds = userIds.get(reaction.emoji) ?? [];
      reactionUserIds.push(reaction.userId);
      userIds.set(reaction.emoji, reactionUserIds);
    }

    return Array.from(groups.entries()).map(([emoji, userNames]) => ({
      emoji,
      count: userNames.length,
      userNames: userNames.join(', '),
      isOwnReaction: (userIds.get(emoji) ?? []).includes(this.currentUserId ?? ''),
    }));
  }

  private handleMessageDeleted(event: ChatMessageDeletedEvent): void {
    if (!this.conversation?.id || event.conversationId !== this.conversation.id) {
      return;
    }

    this.messages = this.messages.filter((message) => message.id !== event.messageId);

    if (this.replyTarget?.id === event.messageId) {
      this.cancelReply();
    }
  }

  private handleMessagePinStateChanged(event: ChatMessagePinStateChangedEvent): void {
    if (!this.conversation?.id || event.conversationId !== this.conversation.id) {
      return;
    }

    this.messages = this.messages.map((message) =>
      message.id === event.messageId
        ? { ...message, isPinned: event.isPinned, pinnedAt: event.pinnedAt }
        : message,
    );
  }

  private handleMessageReactionsChanged(event: ChatMessageReactionsChangedEvent): void {
    if (!this.conversation?.id || event.conversationId !== this.conversation.id) {
      return;
    }

    this.messages = this.messages.map((message) =>
      message.id === event.messageId ? { ...message, reactions: event.reactions } : message,
    );
  }

  canSendMessage(): boolean {
    return !!this.conversation?.id && !!this.messageText.trim() && !this.isSending;
  }

  onMessageInputChange(): void {
    if (!this.conversation?.id) {
      return;
    }

    if (!this.messageText.trim()) {
      this.stopTypingLocally();
      return;
    }

    if (!this.isTypingActive && !this.typingStartTimeoutId) {
      this.typingStartTimeoutId = setTimeout(() => {
        this.typingStartTimeoutId = undefined;

        if (!this.conversation?.id || !this.messageText.trim() || this.isTypingActive) {
          return;
        }

        this.isTypingActive = true;
        void this.chatRealtimeService.startTyping('private', this.conversation.id);
      }, 300);
    }

    this.scheduleTypingStop();
  }

  syncMessageSelection(): void {
    const input = this.messageInput?.nativeElement;

    if (!input) {
      return;
    }

    this.messageSelectionStart = input.selectionStart;
    this.messageSelectionEnd = input.selectionEnd;
  }

  insertEmoji(emoji: string): void {
    const insertionResult = insertTextAtSelection(
      this.messageText,
      emoji,
      this.messageSelectionStart,
      this.messageSelectionEnd,
    );

    this.messageText = insertionResult.nextValue;
    this.messageSelectionStart = insertionResult.nextCursorStart;
    this.messageSelectionEnd = insertionResult.nextCursorEnd;
    this.onMessageInputChange();

    queueMicrotask(() => {
      const input = this.messageInput?.nativeElement;

      if (!input) {
        return;
      }

      input.focus();
      input.setSelectionRange(
        insertionResult.nextCursorStart,
        insertionResult.nextCursorEnd,
      );
    });
  }

  onMessagesScroll(): void {
    this.syncScrollButtonVisibility();
  }

  scrollMessagesToLatest(): void {
    this.scrollMessagesToBottom('smooth');
  }

  shouldShowOwnMessageStatus(message: PrivateMessage): boolean {
    return this.isOwnMessage(message) && this.getLatestOwnMessageId() === message.id && !message.sendStatus;
  }

  getMessageStatusLabel(message: PrivateMessage): string {
    if (message.seenAt) {
      return this.languageService.translate('seen');
    }

    if (message.deliveredAt) {
      return this.languageService.translate('delivered');
    }

    return this.languageService.translate('sent');
  }

  hasTypingUsers(): boolean {
    return this.typingUsers.size > 0;
  }

  getTypingIndicatorAvatarUrl(): string | null {
    return this.conversation?.otherProfilePictureUrl ?? null;
  }

  getTypingIndicatorAvatarAlt(): string {
    return this.conversation?.otherFullName ?? this.languageService.translate('messages');
  }

  openConversation(conversationId: number): void {
    if (this.conversation?.id === conversationId) {
      return;
    }

    this.router.navigate(['/messages/private', conversationId]);
  }

  openChatListItem(item: ChatInboxItem): void {
    if (item.type === 'private' && item.conversationId) {
      void this.router.navigate(['/messages/private', item.conversationId]);
      return;
    }

    if (item.type === 'group' && item.groupId) {
      void this.router.navigate(['/groups', item.groupId, 'chat']);
    }
  }

  isActiveChatListItem(item: ChatInboxItem): boolean {
    return item.type === 'private' && item.conversationId === this.conversation?.id;
  }

  isHighlightedChatListItem(item: ChatInboxItem): boolean {
    return this.highlightedChatListKeys.has(getChatListItemKey(item));
  }

  shouldShowChatListPresenceDot(item: ChatInboxItem): boolean {
    return shouldShowChatListPresenceDotHelper(
      item,
      this.currentUserId,
      this.privateChatListPresenceByUserId,
      this.groupChatListPresenceByGroupId,
    );
  }

  loadChat = () => {
    const conversationId = Number(this.route.snapshot.paramMap.get('conversationId'));

    if (conversationId) {
      this.loadChatListItems();

      return this.privateChatService.getConversations().pipe(
        catchError((error) => {
          console.error('Error loading private chat conversation:', error);
          return throwError(() => error);
        }),
        switchMap((conversations) => {
          this.conversations = conversations;
          const conversation = conversations.find((item) => item.id === conversationId);

          if (!conversation) {
            this.router.navigate(['/messages']);
            return NEVER;
          }

          this.conversation = conversation;

          return this.privateChatService.getMessages(conversationId).pipe(
            tap((messages) => {
              this.messages = messages;
              this.resolveConversationPresenceVisibility();
              this.markConversationAsRead(conversationId);
              this.scrollMessagesToBottom();
              this.acknowledgeLoadedMessages();
            }),
            catchError((error) => {
              console.error('Error loading private chat messages:', error);
              return throwError(() => error);
            }),
          );
        }),
      );
    }

    const targetUserId = this.route.snapshot.paramMap.get('userId');
    if (!targetUserId) {
      return NEVER;
    }

    return this.privateChatService.getOrCreateConversation(targetUserId).pipe(
      tap((conversation) => {
        this.router.navigate(['/messages/private', conversation.id], { replaceUrl: true });
      }),
      catchError((error) => {
        console.error('Error opening private chat from user search:', error);
        return throwError(() => error);
      }),
    );
  }

  private resetViewState(): void {
    this.stopTypingLocally();
    this.conversation = null;
    this.messages = [];
    this.messageText = '';
    this.isSending = false;
    this.showScrollToBottomButton = false;
    this.isOtherUserOnline = false;
    this.isOtherUserPresenceKnown = false;
    this.canShowOtherUserPresence = false;
    this.privateChatListPresenceByUserId.clear();
    this.groupChatListPresenceByGroupId.clear();
    this.highlightedChatListKeys.clear();
    this.pendingStatusUpdates.clear();
    this.typingUsers.clear();
    clearAllTypingEntryExpiries(this.typingEntryExpiryTimers);
    this.messageSelectionStart = null;
    this.messageSelectionEnd = null;
  }

  private loadChatListItems(): void {
    this.chatInboxService.getInboxItems(this.currentUserId).subscribe({
      next: (items) => {
        this.chatListItems = items;
        this.highlightedChatListKeys = createChatListHighlightedKeys(items);
        this.syncChatListPresenceIndicators(items);
      },
      error: (error) => {
        console.error('Error loading desktop chat list items:', error);
      },
    });
  }

  private markConversationAsRead(conversationId: number): void {
    this.privateChatNotificationService.markConversationAsRead(conversationId).subscribe({
      next: () => {
        this.privateChatNotificationService.notifyUnreadCountChanged();
      },
      error: (error) => {
        console.error('Error marking private conversation as read:', error);
      },
    });
  }

  private async setupRealtime(conversationId: number): Promise<void> {
    if (this.connectedConversationId !== null && this.connectedConversationId !== conversationId) {
      await this.chatRealtimeService.leaveConversation(this.connectedConversationId);
    }

    this.connectedConversationId = conversationId;
    await this.chatRealtimeService.joinConversation(conversationId);
  }


  private handleIncomingRealtimeMessage(message: PrivateMessage): void {
    if (!this.conversation?.id || message.conversationId !== this.conversation.id) {
      return;
    }

    if (!this.reconcileOptimisticMessage(message)) {
      const appendResult = appendMessageIfNotExists(
        this.messages,
        message,
        this.pendingStatusUpdates,
      );
      this.messages = appendResult.messages;

      if (!appendResult.appended) {
        return;
      }
    }

    this.scrollMessagesToBottom('smooth');
    this.markConversationAsRead(message.conversationId);
    this.acknowledgeIncomingMessage(message);
    this.typingUsers.delete(message.senderUserId);
  }

  private retryFailedMessages(): void {
    if (!this.conversation?.id) {
      return;
    }

    const failedMessages = this.messages.filter((message) => message.sendStatus === 'failed');

    for (const failedMessage of failedMessages) {
      this.retryMessage(failedMessage);
    }
  }

  private retryMessage(message: PrivateMessage): void {
    if (!this.conversation?.id || !message.clientTempId) {
      return;
    }

    const conversationId = this.conversation.id;
    const clientTempId = message.clientTempId;

    this.messages = this.messages.map((existingMessage) =>
      existingMessage.clientTempId === clientTempId
        ? { ...existingMessage, sendStatus: 'sending' as const }
        : existingMessage,
    );

    this.privateChatService.sendMessageToConversation(conversationId, message.messageText, message.replyToMessageId ?? null).subscribe({
      next: (sentMessage) => {
        this.messages = this.messages.map((existingMessage) =>
          existingMessage.clientTempId === clientTempId ? sentMessage : existingMessage,
        );
      },
      error: (error) => {
        this.messages = this.messages.map((existingMessage) =>
          existingMessage.clientTempId === clientTempId
            ? { ...existingMessage, sendStatus: 'failed' as const }
            : existingMessage,
        );
        console.error('Error retrying private chat message:', error);
      },
    });
  }

  private reconcileOptimisticMessage(message: PrivateMessage): boolean {
    if (message.senderUserId !== this.currentUserId) {
      return false;
    }

    const pendingIndex = this.messages.findIndex((existingMessage) =>
      existingMessage.sendStatus === 'sending' || existingMessage.sendStatus === 'failed',
    );
    if (pendingIndex === -1) {
      return false;
    }

    this.messages = this.messages.map((existingMessage, index) =>
      index === pendingIndex ? message : existingMessage,
    );

    return true;
  }

  private handleStatusUpdate(update: ChatMessageStatusUpdate): void {
    if (update.chatType !== 'private'
      || !this.conversation?.id
      || update.conversationId !== this.conversation.id) {
      return;
    }

    const updateResult = applyStatusUpdateToMessages(
      this.messages,
      update,
    );
    this.messages = updateResult.messages;

    if (!updateResult.didUpdateExistingMessage) {
      this.pendingStatusUpdates.set(update.messageId, this.mergeStatusUpdates(
        this.pendingStatusUpdates.get(update.messageId),
        update,
      ));
    }
  }

  private acknowledgeIncomingMessage(message: PrivateMessage): void {
    if (!this.conversation?.id || this.isOwnMessage(message)) {
      return;
    }

    void this.chatRealtimeService.acknowledgePrivateMessageDelivered(this.conversation.id, message.id);
    void this.chatRealtimeService.acknowledgePrivateMessageSeen(this.conversation.id, message.id);
  }

  private acknowledgeLoadedMessages(): void {
    if (!this.conversation?.id) {
      return;
    }

    const latestIncomingMessageId = [...this.messages]
      .reverse()
      .find((message) => !this.isOwnMessage(message))?.id;

    for (const message of this.messages) {
      if (this.isOwnMessage(message)) {
        continue;
      }

      void this.chatRealtimeService.acknowledgePrivateMessageDelivered(this.conversation.id, message.id);

      if (latestIncomingMessageId === message.id) {
        void this.chatRealtimeService.acknowledgePrivateMessageSeen(this.conversation.id, message.id);
      }
    }
  }

  private mergeStatusUpdates(
    currentUpdate: ChatMessageStatusUpdate | undefined,
    nextUpdate: ChatMessageStatusUpdate,
  ): ChatMessageStatusUpdate {
    return mergePendingStatusUpdates(currentUpdate, nextUpdate);
  }

  private handleTypingEvent(event: ChatTypingEvent): void {
    if (event.type !== 'private'
      || !this.conversation?.id
      || event.targetId !== this.conversation.id.toString()
      || event.userId !== this.conversation.otherUserId) {
      return;
    }

    const shouldStickToBottom = !this.showScrollToBottomButton;
    this.typingUsers.set(event.userId, event.userName);
    scheduleTypingEntryExpiry(this.typingEntryExpiryTimers, event.userId, () => {
      this.typingUsers.delete(event.userId);
      this.adjustScrollAfterTypingStateChange(!this.showScrollToBottomButton);
    });
    this.adjustScrollAfterTypingStateChange(shouldStickToBottom);
  }

  private handleStopTypingEvent(event: ChatTypingEvent): void {
    if (event.type !== 'private'
      || !this.conversation?.id
      || event.targetId !== this.conversation.id.toString()) {
      return;
    }

    const shouldStickToBottom = !this.showScrollToBottomButton;
    this.typingUsers.delete(event.userId);
    clearTypingEntryExpiry(this.typingEntryExpiryTimers, event.userId);
    this.adjustScrollAfterTypingStateChange(shouldStickToBottom);
  }

  private handlePresenceUpdate(update: UserPresence): void {
    if (this.conversation && this.canShowOtherUserPresence && update.userId === this.conversation.otherUserId) {
      this.isOtherUserPresenceKnown = true;
      this.isOtherUserOnline = update.isOnline;
    }

    this.applyChatListPresenceUpdate(update.userId, update.isOnline);
  }

  private loadConversationPresence(userId: string): void {
    this.presenceService.getUserPresence(userId).subscribe({
      next: (presence) => {
        this.canShowOtherUserPresence = true;
        this.isOtherUserPresenceKnown = true;
        this.isOtherUserOnline = presence.isOnline;
      },
      error: (error) => {
        this.canShowOtherUserPresence = false;
        this.isOtherUserPresenceKnown = false;
        this.isOtherUserOnline = false;
        console.error('Error loading private chat presence state:', error);
      },
    });
  }

  private resolveConversationPresenceVisibility(): void {
    const otherUserId = this.conversation?.otherUserId;

    if (!otherUserId) {
      this.canShowOtherUserPresence = false;
      this.isOtherUserPresenceKnown = false;
      this.isOtherUserOnline = false;
      return;
    }

    if (this.hasPrivateChatHistory()) {
      this.loadConversationPresence(otherUserId);
      return;
    }

    forkJoin({
      adminGroups: this.groupService.getMyGroups().pipe(catchError(() => of([] as Group[]))),
      memberGroups: this.groupService.getMemberGroups().pipe(catchError(() => of([] as Group[]))),
    }).subscribe({
      next: ({ adminGroups, memberGroups }) => {
        const uniqueGroupIds = Array.from(
          new Set([...adminGroups, ...memberGroups].map((group) => group.id)),
        );

        if (!uniqueGroupIds.length) {
          this.canShowOtherUserPresence = false;
          this.isOtherUserPresenceKnown = false;
          this.isOtherUserOnline = false;
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
            const hasCommonGroup = details
              .filter((group): group is GroupDetails => group !== null)
              .some((group) => group.members.some((member) => member.userId === otherUserId));

            if (!hasCommonGroup) {
              this.canShowOtherUserPresence = false;
              this.isOtherUserPresenceKnown = false;
              this.isOtherUserOnline = false;
              return;
            }

            this.loadConversationPresence(otherUserId);
          },
          error: () => {
            this.canShowOtherUserPresence = false;
            this.isOtherUserPresenceKnown = false;
            this.isOtherUserOnline = false;
          },
        });
      },
      error: () => {
        this.canShowOtherUserPresence = false;
        this.isOtherUserPresenceKnown = false;
        this.isOtherUserOnline = false;
      },
    });
  }

  private hasPrivateChatHistory(): boolean {
    return this.messages.length > 0;
  }

  private scheduleTypingStop(): void {
    this.typingStopTimeoutId = scheduleTypingTimer(this.typingStopTimeoutId, () => {
      this.typingStopTimeoutId = undefined;
      this.stopTypingLocally();
    }, 1500);
  }

  private stopTypingLocally(): void {
    this.typingStartTimeoutId = clearTypingTimer(this.typingStartTimeoutId);
    this.typingStopTimeoutId = clearTypingTimer(this.typingStopTimeoutId);

    if (!this.conversation?.id || !this.isTypingActive) {
      this.isTypingActive = false;
      return;
    }

    this.isTypingActive = false;
    void this.chatRealtimeService.stopTyping('private', this.conversation.id);
  }

  private adjustScrollAfterTypingStateChange(shouldStickToBottom: boolean): void {
    if (!shouldStickToBottom) {
      this.syncScrollButtonVisibility();
      return;
    }

    this.scrollMessagesToBottom();
  }

  private getLatestOwnMessageId(): number | null {
    const latestOwnMessage = [...this.messages]
      .reverse()
      .find((message) => this.isOwnMessage(message));

    return latestOwnMessage?.id ?? null;
  }

  private scrollMessagesToBottom(behavior: ScrollBehavior = 'auto'): void {
    scrollToBottom(() => this.messagesContainer?.nativeElement, behavior);
    this.syncScrollButtonVisibility();
  }

  private syncScrollButtonVisibility(): void {
    this.showScrollToBottomButton = shouldShowScrollButton(() => this.messagesContainer?.nativeElement);
  }

  private applyRealtimeChatListNotification(notification: ChatMessageNotification): void {
    const updateResult = applyRealtimeChatListUpdate({
      items: this.chatListItems,
      highlightedKeys: this.highlightedChatListKeys,
      notification,
      currentUserId: this.currentUserId,
      isCurrentOpenChat: notification.type === 'private' && notification.conversationId === this.conversation?.id,
      createItem: (incomingNotification, shouldHighlight) =>
        incomingNotification.type === 'private'
          ? createPrivateChatListItemFromNotification(incomingNotification, shouldHighlight, this.conversation)
          : createGroupChatListItemFromNotification(
              incomingNotification,
              shouldHighlight,
              null,
              this.currentUserId,
              (key) => this.languageService.translate(key),
            ),
    });

    this.chatListItems = updateResult.items;
    this.highlightedChatListKeys = updateResult.highlightedKeys;
    this.syncChatListPresenceIndicators(this.chatListItems);
  }

  private syncChatListPresenceIndicators(items: ChatInboxItem[]): void {
    const syncPlan = planChatListPresenceSync(
      items,
      this.currentUserId,
      this.privateChatListPresenceByUserId,
      this.groupChatListPresenceByGroupId,
    );

    for (const userId of syncPlan.stalePrivateUserIds) {
      this.privateChatListPresenceByUserId.delete(userId);
    }

    for (const groupId of syncPlan.staleGroupIds) {
      this.groupChatListPresenceByGroupId.delete(groupId);
    }

    for (const userId of syncPlan.missingPrivateUserIds) {
      this.loadPrivateChatListPresence(userId);
    }

    for (const groupId of syncPlan.missingGroupIds) {
      this.loadGroupChatListPresence(groupId);
    }
  }

  private loadPrivateChatListPresence(userId: string): void {
    this.presenceService.getUserPresence(userId).subscribe({
      next: (presence) => {
        this.privateChatListPresenceByUserId.set(userId, presence.isOnline);
      },
      error: () => {
        this.privateChatListPresenceByUserId.set(userId, false);
      },
    });
  }

  private loadGroupChatListPresence(groupId: number): void {
    this.presenceService.getGroupPresence(groupId).subscribe({
      next: (presence) => {
        this.groupChatListPresenceByGroupId.set(groupId, presence.onlineUserIds.length > 0);
      },
      error: () => {
        this.groupChatListPresenceByGroupId.set(groupId, false);
      },
    });
  }

  private applyChatListPresenceUpdate(userId: string, isOnline: boolean): void {
    const updateResult = applyChatListPresenceUpdate(
      this.chatListItems,
      userId,
      isOnline,
      this.currentUserId,
      this.privateChatListPresenceByUserId,
    );

    this.privateChatListPresenceByUserId = updateResult.nextPrivatePresenceByUserId;

    for (const groupId of updateResult.groupIdsToReload) {
      this.loadGroupChatListPresence(groupId);
    }
  }
}
