import { NgClass, NgFor, NgIf } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, NEVER, Subscription, switchMap, tap, throwError } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { ChatRealtimeService } from '../../services/chat-realtime.service';
import { ChatInboxService } from '../../services/chat-inbox.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { GroupChatNotificationService } from '../../services/group-chat-notification.service';
import { GroupService } from '../../services/group.service';
import { LanguageService } from '../../services/language.service';
import { PresenceService } from '../../services/presence.service';
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
import { clearTypingTimer, scheduleTypingTimer } from '../helpers/chat-typing.helper';
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
import { GroupPresence } from '../interfaces/group-presence.model';
import { insertTextAtSelection } from '../helpers/chat-input.helper';
import { GroupChatMessage, GroupDetails } from '../interfaces/group.model';
import { UserPresence } from '../interfaces/user-presence.model';
import { ChatEmojiPickerComponent } from '../chat-emoji-picker/chat-emoji-picker.component';
import { LongPressDirective } from '../directives/long-press.directive';
import { MessageActionsComponent } from '../message-actions/message-actions.component';
import { NavbarComponent } from '../navbar/navbar.component';
import { TranslatePipe } from '../pipes/translate.pipe';
import { LiveRelativeTimePipe } from '../pipes/live-relative-time.pipe';
import { SkeletonComponent } from '../skeleton/skeleton/skeleton.component';
import { LoadErrorStateComponent } from '../load-error-state/load-error-state.component';
import { ToastService } from '../../services/toast.service';

@Component({
  selector: 'app-group-chat',
  imports: [
    NgIf,
    NgFor,
    NgClass,
    FormsModule,
    RouterLink,
    NavbarComponent,
    TranslatePipe,
    LiveRelativeTimePipe,
    ChatEmojiPickerComponent,
    SkeletonComponent,
    LongPressDirective,
    MessageActionsComponent,
    LoadErrorStateComponent,
  ],
  templateUrl: './group-chat.component.html',
  styleUrl: './group-chat.component.scss',
})
export class GroupChatComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('messagesContainer') private messagesContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('messageInput') private messageInput?: ElementRef<HTMLInputElement>;
  @ViewChild('chatState') chatState!: LoadErrorStateComponent;

  group: GroupDetails | null = null;
  chatListItems: ChatInboxItem[] = [];
  highlightedChatListKeys = new Set<string>();
  messages: GroupChatMessage[] = [];
  messageText = '';
  isSending = false;
  readonly skeletonBubbles = [
    { width: '55%', own: false },
    { width: '40%', own: true },
    { width: '65%', own: false },
  ];
  showScrollToBottomButton = false;
  errorMessage = '';
  onlineMemberUserIds = new Set<string>();
  privateChatListPresenceByUserId = new Map<string, boolean>();
  groupChatListPresenceByGroupId = new Map<number, boolean>();
  replyTarget: GroupChatMessage | null = null;
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
  private connectedGroupId: number | null = null;
  private pendingStatusUpdates = new Map<number, ChatMessageStatusUpdate>();
  private readonly typingUsers = new Map<string, string>();
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
    private groupService: GroupService,
    private groupChatNotificationService: GroupChatNotificationService,
    private languageService: LanguageService,
    private presenceService: PresenceService,
    private toastService: ToastService,
    private confirmDialogService: ConfirmDialogService,
  ) {}

  ngOnInit(): void {
    void this.chatRealtimeService.connect();

    this.currentUserSubscription = this.authService.currentUser.subscribe((user) => {
      this.currentUserId = user?.token ? getUserIdFromToken(user.token) : null;
    });

    this.realtimeMessageSubscription = this.chatRealtimeService.incomingGroupMessages$.subscribe((message) => {
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

    this.realtimeMessageDeletedSubscription = this.chatRealtimeService.incomingGroupMessageDeleted$.subscribe((event) => {
      this.handleMessageDeleted(event);
    });

    this.realtimeMessagePinStateChangedSubscription = this.chatRealtimeService.incomingGroupMessagePinStateChanged$.subscribe((event) => {
      this.handleMessagePinStateChanged(event);
    });

    this.realtimeMessageReactionsChangedSubscription = this.chatRealtimeService.incomingGroupMessageReactionsChanged$.subscribe((event) => {
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
      const groupId = Number(params.get('id'));

      if (!groupId) {
        this.router.navigate(['/groups']);
        return;
      }

      if (this.isInitialRouteParamsEmission) {
        this.isInitialRouteParamsEmission = false;
        void this.setupRealtime(groupId);
        return;
      }

      this.resetViewState();
      void this.initializeGroupChat(groupId);
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
    if (this.connectedGroupId !== null) {
      void this.chatRealtimeService.leaveGroup(this.connectedGroupId);
    }
    void this.chatRealtimeService.disconnect();
  }

  sendMessage(): void {
    const trimmedMessage = this.messageText.trim();
    if (!this.group?.id || !trimmedMessage || this.isSending) {
      return;
    }

    this.stopTypingLocally();
    this.isSending = true;

    const groupId = this.group.id;
    const replyTarget = this.replyTarget;
    const clientTempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const optimisticMessage: GroupChatMessage = {
      id: -Date.now(),
      groupId,
      senderUserId: this.currentUserId ?? '',
      senderUsername: '',
      senderFullName: this.getCurrentUserDisplayName(),
      senderProfilePictureUrl: this.getCurrentUserProfilePictureUrl(),
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

    this.groupService.sendGroupMessage(groupId, trimmedMessage, replyTarget?.id ?? null).subscribe({
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
        this.toastService.showError(this.languageService.translate('groupChatSendError'));
        console.error('Error sending group chat message:', error);
      },
    });
  }

  isOwnMessage(message: GroupChatMessage): boolean {
    return message.senderUserId === this.group?.currentUserId;
  }

  isMessageFailed(message: GroupChatMessage): boolean {
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

  startReply(message: GroupChatMessage): void {
    this.replyTarget = message;
    this.messageInput?.nativeElement.focus();
  }

  cancelReply(): void {
    this.replyTarget = null;
  }

  private swipingMessageId: number | null = null;
  private swipeOffsetPx = 0;

  isSwiping(message: GroupChatMessage): boolean {
    return this.swipingMessageId === message.id;
  }

  getSwipeOffset(message: GroupChatMessage): number {
    return this.swipingMessageId === message.id ? this.swipeOffsetPx : 0;
  }

  onSwipeProgress(message: GroupChatMessage, deltaPx: number): void {
    this.swipingMessageId = message.id;
    this.swipeOffsetPx = this.isOwnMessage(message) ? Math.min(0, deltaPx) : Math.max(0, deltaPx);
  }

  onSwipeCompleted(message: GroupChatMessage, direction: 'left' | 'right'): void {
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

  copyMessageText(message: GroupChatMessage): void {
    navigator.clipboard.writeText(message.messageText).then(
      () => this.toastService.showSuccess(this.languageService.translate('messageCopied')),
      () => this.toastService.showError(this.languageService.translate('messageCopyError')),
    );
  }

  async requestUnsend(message: GroupChatMessage): Promise<void> {
    if (!this.group?.id) {
      return;
    }

    const confirmed = await this.confirmDialogService.confirm('confirmUnsendMessage');
    if (!confirmed) {
      return;
    }

    this.groupService.deleteGroupMessage(this.group.id, message.id).subscribe({
      error: (error) => {
        this.toastService.showError(this.languageService.translate('unsendMessageError'));
        console.error('Error unsending group chat message:', error);
      },
    });
  }

  requestPin(message: GroupChatMessage): void {
    if (!this.group?.id) {
      return;
    }

    this.groupService.setGroupMessagePinned(this.group.id, message.id, !message.isPinned).subscribe({
      error: (error) => {
        this.toastService.showError(this.languageService.translate('pinMessageError'));
        console.error('Error pinning group chat message:', error);
      },
    });
  }

  onBubbleDoubleClick(event: MouseEvent, message: GroupChatMessage): void {
    if (this.isMessageFailed(message)) {
      return;
    }

    event.preventDefault();
    this.reactToMessage(message, '❤️');
  }

  reactToMessage(message: GroupChatMessage, emoji: string): void {
    if (!this.group?.id) {
      return;
    }

    const existingEmoji = this.getCurrentUserReactionEmoji(message);
    const request$ = existingEmoji === emoji
      ? this.groupService.removeGroupMessageReaction(this.group.id, message.id)
      : this.groupService.addOrUpdateGroupMessageReaction(this.group.id, message.id, emoji);

    request$.subscribe({
      error: (error) => {
        this.toastService.showError(this.languageService.translate('reactToMessageError'));
        console.error('Error reacting to group chat message:', error);
      },
    });
  }

  getCurrentUserReactionEmoji(message: GroupChatMessage): string | null {
    return message.reactions?.find((reaction) => reaction.userId === this.currentUserId)?.emoji ?? null;
  }

  getGroupedReactions(message: GroupChatMessage): { emoji: string; count: number; userNames: string; isOwnReaction: boolean }[] {
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

  private retryFailedMessages(): void {
    if (!this.group?.id) {
      return;
    }

    const failedMessages = this.messages.filter((message) => message.sendStatus === 'failed');

    for (const failedMessage of failedMessages) {
      this.retryMessage(failedMessage);
    }
  }

  private retryMessage(message: GroupChatMessage): void {
    if (!this.group?.id || !message.clientTempId) {
      return;
    }

    const groupId = this.group.id;
    const clientTempId = message.clientTempId;

    this.messages = this.messages.map((existingMessage) =>
      existingMessage.clientTempId === clientTempId
        ? { ...existingMessage, sendStatus: 'sending' as const }
        : existingMessage,
    );

    this.groupService.sendGroupMessage(groupId, message.messageText, message.replyToMessageId ?? null).subscribe({
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
        console.error('Error retrying group chat message:', error);
      },
    });
  }

  private reconcileOptimisticMessage(message: GroupChatMessage): boolean {
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

  private getCurrentUserDisplayName(): string {
    return this.group?.members.find((member) => member.userId === this.currentUserId)?.displayName ?? '';
  }

  private getCurrentUserProfilePictureUrl(): string | null {
    return this.group?.members.find((member) => member.userId === this.currentUserId)?.profilePictureUrl ?? null;
  }

  private handleMessageDeleted(event: ChatMessageDeletedEvent): void {
    if (!this.group?.id || event.groupId !== this.group.id) {
      return;
    }

    this.messages = this.messages.filter((message) => message.id !== event.messageId);

    if (this.replyTarget?.id === event.messageId) {
      this.cancelReply();
    }
  }

  private handleMessagePinStateChanged(event: ChatMessagePinStateChangedEvent): void {
    if (!this.group?.id || event.groupId !== this.group.id) {
      return;
    }

    this.messages = this.messages.map((message) =>
      message.id === event.messageId
        ? { ...message, isPinned: event.isPinned, pinnedAt: event.pinnedAt }
        : message,
    );
  }

  private handleMessageReactionsChanged(event: ChatMessageReactionsChangedEvent): void {
    if (!this.group?.id || event.groupId !== this.group.id) {
      return;
    }

    this.messages = this.messages.map((message) =>
      message.id === event.messageId ? { ...message, reactions: event.reactions } : message,
    );
  }

  canSendMessage(): boolean {
    return !!this.group?.isMember && !!this.messageText.trim() && !this.isSending;
  }

  onMessageInputChange(): void {
    if (!this.group?.id) {
      return;
    }

    if (!this.messageText.trim()) {
      this.stopTypingLocally();
      return;
    }

    if (!this.isTypingActive && !this.typingStartTimeoutId) {
      this.typingStartTimeoutId = setTimeout(() => {
        this.typingStartTimeoutId = undefined;

        if (!this.group?.id || !this.messageText.trim() || this.isTypingActive) {
          return;
        }

        this.isTypingActive = true;
        void this.chatRealtimeService.startTyping('group', this.group.id);
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

  shouldShowMessageStatus(message: GroupChatMessage): boolean {
    if (!this.isLatestChatMessage(message) || message.sendStatus) {
      return false;
    }

    return this.shouldShowSeenByMembers(message)
      || this.isOwnMessage(message);
  }

  getMessageStatusLabel(message: GroupChatMessage): string {
    if (message.seenAt) {
      return this.languageService.translate('seen');
    }

    if (message.deliveredAt) {
      return this.languageService.translate('delivered');
    }

    return this.languageService.translate('sent');
  }

  getTypingIndicatorText(): string {
    const typingNames = [...this.typingUsers.values()];

    if (!typingNames.length) {
      return '';
    }

    if (typingNames.length === 1) {
      return `${typingNames[0]} ${this.languageService.translate('isTyping')}`;
    }

    return this.languageService.translate('usersAreTyping')
      .replace('{count}', typingNames.length.toString());
  }

  hasTypingUsers(): boolean {
    return this.typingUsers.size > 0;
  }

  hasOnlineMembers(): boolean {
    return this.onlineMemberUserIds.size > 0;
  }

  getGroupPresenceLabel(): string {
    return this.hasOnlineMembers()
      ? this.languageService.translate('activeMembers')
      : this.languageService.translate('noActiveMembers');
  }

  getTypingIndicatorAvatarUrl(): string | null {
    const firstTypingUserId = this.typingUsers.keys().next().value as string | undefined;
    if (!firstTypingUserId) {
      return null;
    }

    return this.group?.members.find((member) => member.userId === firstTypingUserId)?.profilePictureUrl ?? null;
  }

  getTypingIndicatorAvatarAlt(): string {
    const firstTypingUserName = this.typingUsers.values().next().value as string | undefined;
    return firstTypingUserName ?? this.languageService.translate('groupChat');
  }

  openChatListItem(item: ChatInboxItem): void {
    if (item.type === 'group' && item.groupId) {
      void this.router.navigate(['/groups', item.groupId, 'chat']);
      return;
    }

    if (item.type === 'private' && item.conversationId) {
      void this.router.navigate(['/messages/private', item.conversationId]);
    }
  }

  isActiveChatListItem(item: ChatInboxItem): boolean {
    return item.type === 'group' && item.groupId === this.group?.id;
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
    const groupId = Number(this.route.snapshot.paramMap.get('id'));
    if (!groupId) {
      return NEVER;
    }

    this.loadChatListItems();

    return this.groupService.getGroupDetails(groupId).pipe(
      catchError((error) => {
        console.error('Error loading group chat details:', error);
        return throwError(() => error);
      }),
      switchMap((group) => {
        if (!group.isMember) {
          this.router.navigate(['/groups', groupId]);
          return NEVER;
        }

        this.group = group;
        this.loadGroupPresence(group.id);

        return this.groupService.getGroupMessages(groupId).pipe(
          tap((messages) => {
            this.messages = messages;
            this.scrollMessagesToBottom();
            this.markCurrentGroupChatAsRead(groupId);
            this.acknowledgeLoadedMessages();
          }),
          catchError((error) => {
            console.error('Error loading group chat messages:', error);
            return throwError(() => error);
          }),
        );
      }),
    );
  }

  private resetViewState(): void {
    this.stopTypingLocally();
    this.group = null;
    this.messages = [];
    this.messageText = '';
    this.isSending = false;
    this.showScrollToBottomButton = false;
    this.onlineMemberUserIds.clear();
    this.privateChatListPresenceByUserId.clear();
    this.groupChatListPresenceByGroupId.clear();
    this.highlightedChatListKeys.clear();
    this.pendingStatusUpdates.clear();
    this.typingUsers.clear();
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

  private async setupRealtime(groupId: number): Promise<void> {
    if (this.connectedGroupId !== null && this.connectedGroupId !== groupId) {
      await this.chatRealtimeService.leaveGroup(this.connectedGroupId);
    }

    this.connectedGroupId = groupId;
    await this.chatRealtimeService.joinGroup(groupId);
  }

  private async initializeGroupChat(groupId: number): Promise<void> {
    await this.setupRealtime(groupId);
    this.chatState.reload();
  }

  private scrollMessagesToBottom(behavior: ScrollBehavior = 'auto'): void {
    scrollToBottom(() => this.messagesContainer?.nativeElement, behavior);
    this.syncScrollButtonVisibility();
  }

  private syncScrollButtonVisibility(): void {
    this.showScrollToBottomButton = shouldShowScrollButton(() => this.messagesContainer?.nativeElement);
  }

  private markCurrentGroupChatAsRead(groupId: number): void {
    this.groupChatNotificationService.markGroupAsRead(groupId).subscribe({
      next: () => {
        this.groupChatNotificationService.notifyUnreadCountChanged();
      },
      error: (error) => {
        console.error('Error marking group chat as read:', error);
      },
    });
  }

  private handleIncomingRealtimeMessage(message: GroupChatMessage): void {
    if (!this.group?.id || message.groupId !== this.group.id) {
      return;
    }

    if (!this.reconcileOptimisticMessage(message)) {
      const appendResult = appendMessageIfNotExists(
        this.messages,
        message,
        this.pendingStatusUpdates,
        this.mapSeenByStatusFields,
      );
      this.messages = appendResult.messages;

      if (!appendResult.appended) {
        return;
      }
    }

    this.scrollMessagesToBottom('smooth');
    this.markCurrentGroupChatAsRead(message.groupId);
    this.acknowledgeIncomingMessage(message);
    this.typingUsers.delete(message.senderUserId);
  }

  private handleStatusUpdate(update: ChatMessageStatusUpdate): void {
    if (update.chatType !== 'group' || !this.group?.id || update.groupId !== this.group.id) {
      return;
    }

    const updateResult = applyStatusUpdateToMessages(
      this.messages,
      update,
      this.mapSeenByStatusFields,
    );
    this.messages = updateResult.messages;

    if (!updateResult.didUpdateExistingMessage) {
      this.pendingStatusUpdates.set(update.messageId, this.mergeStatusUpdates(
        this.pendingStatusUpdates.get(update.messageId),
        update,
      ));
    }
  }

  private acknowledgeIncomingMessage(message: GroupChatMessage): void {
    if (!this.group?.id || this.isOwnMessage(message)) {
      return;
    }

    void this.chatRealtimeService.acknowledgeGroupMessageDelivered(this.group.id, message.id);
    void this.chatRealtimeService.acknowledgeGroupMessageSeen(this.group.id, message.id);
  }

  private acknowledgeLoadedMessages(): void {
    if (!this.group?.id) {
      return;
    }

    const latestIncomingMessageId = [...this.messages]
      .reverse()
      .find((message) => !this.isOwnMessage(message))?.id;

    for (const message of this.messages) {
      if (this.isOwnMessage(message)) {
        continue;
      }

      void this.chatRealtimeService.acknowledgeGroupMessageDelivered(this.group.id, message.id);

      if (latestIncomingMessageId === message.id) {
        void this.chatRealtimeService.acknowledgeGroupMessageSeen(this.group.id, message.id);
      }
    }
  }

  private mapSeenByStatusFields(
    message: GroupChatMessage,
    update: ChatMessageStatusUpdate,
  ): Partial<GroupChatMessage> {
    return {
      seenByUserIds: update.seenByUserIds ?? message.seenByUserIds ?? [],
      seenByUserNames: update.seenByUserNames ?? message.seenByUserNames ?? [],
      seenByUserProfilePictureUrls: update.seenByUserProfilePictureUrls ?? message.seenByUserProfilePictureUrls ?? [],
    };
  }

  private mergeStatusUpdates(
    currentUpdate: ChatMessageStatusUpdate | undefined,
    nextUpdate: ChatMessageStatusUpdate,
  ): ChatMessageStatusUpdate {
    return mergePendingStatusUpdates(currentUpdate, nextUpdate);
  }

  private handleTypingEvent(event: ChatTypingEvent): void {
    if (event.type !== 'group'
      || !this.group?.id
      || event.targetId !== this.group.id.toString()
      || event.userId === this.group.currentUserId) {
      return;
    }

    const shouldStickToBottom = !this.showScrollToBottomButton;
    this.typingUsers.set(event.userId, event.userName);
    this.adjustScrollAfterTypingStateChange(shouldStickToBottom);
  }

  private handleStopTypingEvent(event: ChatTypingEvent): void {
    if (event.type !== 'group'
      || !this.group?.id
      || event.targetId !== this.group.id.toString()) {
      return;
    }

    const shouldStickToBottom = !this.showScrollToBottomButton;
    this.typingUsers.delete(event.userId);
    this.adjustScrollAfterTypingStateChange(shouldStickToBottom);
  }

  private handlePresenceUpdate(update: UserPresence): void {
    if (!this.group || !this.isPresenceRelevantToCurrentGroup(update.userId)) {
      this.applyChatListPresenceUpdate(update.userId, update.isOnline);
      return;
    }

    const nextOnlineUserIds = new Set(this.onlineMemberUserIds);

    if (update.isOnline) {
      nextOnlineUserIds.add(update.userId);
    } else {
      nextOnlineUserIds.delete(update.userId);
    }

    this.onlineMemberUserIds = nextOnlineUserIds;
    this.applyChatListPresenceUpdate(update.userId, update.isOnline);
  }

  private loadGroupPresence(groupId: number): void {
    this.presenceService.getGroupPresence(groupId).subscribe({
      next: (presence) => {
        this.applyGroupPresence(presence);
      },
      error: (error) => {
        this.onlineMemberUserIds.clear();
        console.error('Error loading group chat presence state:', error);
      },
    });
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

    if (!this.group?.id || !this.isTypingActive) {
      this.isTypingActive = false;
      return;
    }

    this.isTypingActive = false;
    void this.chatRealtimeService.stopTyping('group', this.group.id);
  }

  private adjustScrollAfterTypingStateChange(shouldStickToBottom: boolean): void {
    if (!shouldStickToBottom) {
      this.syncScrollButtonVisibility();
      return;
    }

    this.scrollMessagesToBottom();
  }

  shouldShowSeenByMembers(message: GroupChatMessage): boolean {
    return !!this.group
      && this.isLatestChatMessage(message)
      && this.getSeenByEntries(message).length > 0;
  }

  getSeenByAvatarItems(message: GroupChatMessage): { name: string; profilePictureUrl: string | null }[] {
    return this.getSeenByEntries(message)
      .slice(0, 2);
  }

  getRemainingSeenByCount(message: GroupChatMessage): number {
    const totalSeenCount = this.getSeenByEntries(message).length;
    return Math.max(totalSeenCount - this.getSeenByAvatarItems(message).length, 0);
  }

  private getSeenByEntries(message: GroupChatMessage): { userId: string; name: string; profilePictureUrl: string | null }[] {
    const userIds = message.seenByUserIds ?? [];
    const names = message.seenByUserNames ?? [];
    const profilePictureUrls = message.seenByUserProfilePictureUrls ?? [];
    const latestMessageSenderId = this.getLatestMessageSenderId();

    return userIds
      .map((userId, index) => ({
        userId,
        name: names[index] ?? '',
        profilePictureUrl: profilePictureUrls[index] ?? 'default-profile.png',
      }))
      .filter((item) =>
        !!item.name.trim()
        && item.userId !== this.group?.currentUserId
        && item.userId !== latestMessageSenderId);
  }

  private getLatestOwnMessageId(): number | null {
    const latestOwnMessage = [...this.messages]
      .reverse()
      .find((message) => this.isOwnMessage(message));

    return latestOwnMessage?.id ?? null;
  }

  private isLatestChatMessage(message: GroupChatMessage): boolean {
    return this.messages[this.messages.length - 1]?.id === message.id;
  }

  private getLatestMessageSenderId(): string | null {
    const latestMessage = this.messages[this.messages.length - 1];

    return latestMessage?.senderUserId ?? null;
  }

  private applyGroupPresence(presence: GroupPresence): void {
    this.onlineMemberUserIds = new Set(
      presence.onlineUserIds.filter((userId) => this.isPresenceRelevantToCurrentGroup(userId)),
    );
  }

  private isPresenceRelevantToCurrentGroup(userId: string): boolean {
    return !!this.group
      && this.group.members.some((member) => member.userId === userId);
  }

  private applyRealtimeChatListNotification(notification: ChatMessageNotification): void {
    const updateResult = applyRealtimeChatListUpdate({
      items: this.chatListItems,
      highlightedKeys: this.highlightedChatListKeys,
      notification,
      currentUserId: this.currentUserId,
      isCurrentOpenChat: notification.type === 'group' && notification.groupId === this.group?.id,
      createItem: (incomingNotification, shouldHighlight) =>
        incomingNotification.type === 'group'
          ? createGroupChatListItemFromNotification(
              incomingNotification,
              shouldHighlight,
              this.group,
              this.currentUserId,
              (key) => this.languageService.translate(key),
            )
          : createPrivateChatListItemFromNotification(incomingNotification, shouldHighlight, null),
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
