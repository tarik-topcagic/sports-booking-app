import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { ChatMessageNotification } from '../app/interfaces/chat-message-notification.model';
import { ChatMessageStatusUpdate } from '../app/interfaces/chat-message-status-update.model';
import {
  ChatMessageDeletedEvent,
  ChatMessagePinStateChangedEvent,
  ChatMessageReactionsChangedEvent,
} from '../app/interfaces/chat-message-mutation-event.model';
import { ChatTypingEvent } from '../app/interfaces/chat-typing-event.model';
import { GroupChatMessage } from '../app/interfaces/group.model';
import { PrivateMessage } from '../app/interfaces/private-chat.model';
import { UserPresence } from '../app/interfaces/user-presence.model';
import { AuthService } from './auth.service';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class ChatRealtimeService {
  private hubConnection: any = null;
  private connectionConsumerCount = 0;
  private connectionStartPromise: Promise<void> | null = null;
  private connectionEstablishPromise: Promise<void> | null = null;
  private disconnectTimeoutId?: ReturnType<typeof setTimeout>;
  private readonly disconnectDelayMs = 5000;
  private joinedGroupIds = new Map<number, number>();
  private joinedConversationIds = new Map<number, number>();
  private readonly incomingGroupMessageSubject = new Subject<GroupChatMessage>();
  private readonly incomingPrivateMessageSubject = new Subject<PrivateMessage>();
  private readonly incomingMessageNotificationSubject = new Subject<ChatMessageNotification>();
  private readonly incomingMessageStatusUpdateSubject = new Subject<ChatMessageStatusUpdate>();
  private readonly incomingTypingSubject = new Subject<ChatTypingEvent>();
  private readonly incomingStopTypingSubject = new Subject<ChatTypingEvent>();
  private readonly incomingPresenceUpdateSubject = new Subject<UserPresence>();
  private readonly incomingGroupMessageDeletedSubject = new Subject<ChatMessageDeletedEvent>();
  private readonly incomingPrivateMessageDeletedSubject = new Subject<ChatMessageDeletedEvent>();
  private readonly incomingGroupMessagePinStateChangedSubject = new Subject<ChatMessagePinStateChangedEvent>();
  private readonly incomingPrivateMessagePinStateChangedSubject = new Subject<ChatMessagePinStateChangedEvent>();
  private readonly incomingGroupMessageReactionsChangedSubject = new Subject<ChatMessageReactionsChangedEvent>();
  private readonly incomingPrivateMessageReactionsChangedSubject = new Subject<ChatMessageReactionsChangedEvent>();
  private readonly reconnectedSubject = new Subject<void>();
  readonly reconnected$ = this.reconnectedSubject.asObservable();
  readonly incomingGroupMessages$ = this.incomingGroupMessageSubject.asObservable();
  readonly incomingPrivateMessages$ = this.incomingPrivateMessageSubject.asObservable();
  readonly incomingMessageNotifications$ = this.incomingMessageNotificationSubject.asObservable();
  readonly incomingMessageStatusUpdates$ = this.incomingMessageStatusUpdateSubject.asObservable();
  readonly incomingTyping$ = this.incomingTypingSubject.asObservable();
  readonly incomingStopTyping$ = this.incomingStopTypingSubject.asObservable();
  readonly incomingPresenceUpdates$ = this.incomingPresenceUpdateSubject.asObservable();
  readonly incomingGroupMessageDeleted$ = this.incomingGroupMessageDeletedSubject.asObservable();
  readonly incomingPrivateMessageDeleted$ = this.incomingPrivateMessageDeletedSubject.asObservable();
  readonly incomingGroupMessagePinStateChanged$ = this.incomingGroupMessagePinStateChangedSubject.asObservable();
  readonly incomingPrivateMessagePinStateChanged$ = this.incomingPrivateMessagePinStateChangedSubject.asObservable();
  readonly incomingGroupMessageReactionsChanged$ = this.incomingGroupMessageReactionsChangedSubject.asObservable();
  readonly incomingPrivateMessageReactionsChanged$ = this.incomingPrivateMessageReactionsChangedSubject.asObservable();

  constructor(private authService: AuthService) {}

  async connect(): Promise<void> {
    this.clearPendingDisconnect();
    this.connectionConsumerCount += 1;
    await this.ensureConnected();
  }

  private async ensureConnected(): Promise<void> {
    const signalR = await import('@microsoft/signalr');

    if (this.hubConnection) {
      if (this.hubConnection.state === signalR.HubConnectionState.Connected) {
        return;
      }

      if (this.hubConnection.state === signalR.HubConnectionState.Connecting
        || this.hubConnection.state === signalR.HubConnectionState.Reconnecting) {
        await this.connectionStartPromise;
        return;
      }
    }

    if (this.connectionEstablishPromise) {
      await this.connectionEstablishPromise;
      return;
    }

    this.connectionEstablishPromise = this.establishConnection(signalR);

    try {
      await this.connectionEstablishPromise;
    } finally {
      this.connectionEstablishPromise = null;
    }
  }

  private async establishConnection(signalR: typeof import('@microsoft/signalr')): Promise<void> {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.getBaseApiUrl()}/hubs/chat`, {
        accessTokenFactory: () => this.authService.currentUserValue?.token ?? '',
      })
      .withAutomaticReconnect()
      .build();

    this.hubConnection.onreconnected(async () => {
      await this.rejoinTrackedRooms();
      this.reconnectedSubject.next();
    });

    this.hubConnection.off('ReceiveGroupMessage');
    this.hubConnection.on('ReceiveGroupMessage', (message: GroupChatMessage) => {
      this.incomingGroupMessageSubject.next(message);
    });

    this.hubConnection.off('ReceivePrivateMessage');
    this.hubConnection.on('ReceivePrivateMessage', (message: PrivateMessage) => {
      this.incomingPrivateMessageSubject.next(message);
    });

    this.hubConnection.off('ReceiveMessageNotification');
    this.hubConnection.on('ReceiveMessageNotification', (notification: ChatMessageNotification) => {
      this.incomingMessageNotificationSubject.next(notification);
    });

    this.hubConnection.off('ReceiveMessageStatusUpdate');
    this.hubConnection.on('ReceiveMessageStatusUpdate', (update: ChatMessageStatusUpdate) => {
      this.incomingMessageStatusUpdateSubject.next(update);
    });

    this.hubConnection.off('UserTyping');
    this.hubConnection.on('UserTyping', (payload: ChatTypingEvent) => {
      this.incomingTypingSubject.next(payload);
    });

    this.hubConnection.off('UserStoppedTyping');
    this.hubConnection.on('UserStoppedTyping', (payload: ChatTypingEvent) => {
      this.incomingStopTypingSubject.next(payload);
    });

    this.hubConnection.off('UserPresenceChanged');
    this.hubConnection.on('UserPresenceChanged', (payload: UserPresence) => {
      this.incomingPresenceUpdateSubject.next(payload);
    });

    this.hubConnection.off('ReceiveGroupMessageDeleted');
    this.hubConnection.on('ReceiveGroupMessageDeleted', (payload: ChatMessageDeletedEvent) => {
      this.incomingGroupMessageDeletedSubject.next(payload);
    });

    this.hubConnection.off('ReceivePrivateMessageDeleted');
    this.hubConnection.on('ReceivePrivateMessageDeleted', (payload: ChatMessageDeletedEvent) => {
      this.incomingPrivateMessageDeletedSubject.next(payload);
    });

    this.hubConnection.off('ReceiveGroupMessagePinStateChanged');
    this.hubConnection.on('ReceiveGroupMessagePinStateChanged', (payload: ChatMessagePinStateChangedEvent) => {
      this.incomingGroupMessagePinStateChangedSubject.next(payload);
    });

    this.hubConnection.off('ReceivePrivateMessagePinStateChanged');
    this.hubConnection.on('ReceivePrivateMessagePinStateChanged', (payload: ChatMessagePinStateChangedEvent) => {
      this.incomingPrivateMessagePinStateChangedSubject.next(payload);
    });

    this.hubConnection.off('ReceiveGroupMessageReactionsChanged');
    this.hubConnection.on('ReceiveGroupMessageReactionsChanged', (payload: ChatMessageReactionsChangedEvent) => {
      this.incomingGroupMessageReactionsChangedSubject.next(payload);
    });

    this.hubConnection.off('ReceivePrivateMessageReactionsChanged');
    this.hubConnection.on('ReceivePrivateMessageReactionsChanged', (payload: ChatMessageReactionsChangedEvent) => {
      this.incomingPrivateMessageReactionsChangedSubject.next(payload);
    });

    try {
      this.connectionStartPromise = this.hubConnection.start()
        .then(async () => {
          await this.rejoinTrackedRooms();
        })
        .catch((error: unknown) => {
          console.error('Error connecting to chat SignalR hub:', error);
          throw error;
        })
        .finally(() => {
          this.connectionStartPromise = null;
        });

      await this.connectionStartPromise;
    } catch (error) {

    }
  }

  async joinGroup(groupId: number): Promise<void> {
    const currentCount = this.joinedGroupIds.get(groupId) ?? 0;
    this.joinedGroupIds.set(groupId, currentCount + 1);

    if (currentCount > 0) {

      return;
    }

    try {
      await this.ensureConnected();
      const signalR = await import('@microsoft/signalr');

      if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
        return;
      }

      await this.hubConnection.invoke('JoinGroup', groupId.toString());
    } catch (error) {
      console.error('Error joining SignalR group chat room:', error);
    }
  }

  async leaveGroup(groupId: number): Promise<void> {
    const currentCount = this.joinedGroupIds.get(groupId) ?? 0;
    const nextCount = Math.max(0, currentCount - 1);

    if (nextCount > 0) {
      this.joinedGroupIds.set(groupId, nextCount);
      return;
    }

    this.joinedGroupIds.delete(groupId);

    try {
      const signalR = await import('@microsoft/signalr');

      if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
        return;
      }

      await this.hubConnection.invoke('LeaveGroup', groupId.toString());
    } catch (error) {
      if (!this.isConnectionClosedCancellation(error)) {
        console.error('Error leaving SignalR group chat room:', error);
      }
    }
  }

  async joinConversation(conversationId: number): Promise<void> {
    const currentCount = this.joinedConversationIds.get(conversationId) ?? 0;
    this.joinedConversationIds.set(conversationId, currentCount + 1);

    if (currentCount > 0) {
      return;
    }

    try {
      await this.ensureConnected();
      const signalR = await import('@microsoft/signalr');

      if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
        return;
      }

      await this.hubConnection.invoke('JoinConversation', conversationId.toString());
    } catch (error) {
      console.error('Error joining SignalR private chat room:', error);
    }
  }

  async leaveConversation(conversationId: number): Promise<void> {
    const currentCount = this.joinedConversationIds.get(conversationId) ?? 0;
    const nextCount = Math.max(0, currentCount - 1);

    if (nextCount > 0) {
      this.joinedConversationIds.set(conversationId, nextCount);
      return;
    }

    this.joinedConversationIds.delete(conversationId);

    try {
      const signalR = await import('@microsoft/signalr');

      if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
        return;
      }

      await this.hubConnection.invoke('LeaveConversation', conversationId.toString());
    } catch (error) {
      if (!this.isConnectionClosedCancellation(error)) {
        console.error('Error leaving SignalR private chat room:', error);
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.connectionConsumerCount > 0) {
      this.connectionConsumerCount -= 1;
    }

    if (this.connectionConsumerCount > 0) {
      return;
    }

    this.clearPendingDisconnect();
    this.disconnectTimeoutId = setTimeout(() => {
      void this.stopConnectionIfUnused();
    }, this.disconnectDelayMs);
  }

  private async stopConnectionIfUnused(): Promise<void> {
    this.disconnectTimeoutId = undefined;

    if (this.connectionConsumerCount > 0 || !this.hubConnection) {
      return;
    }

    try {
      const signalR = await import('@microsoft/signalr');

      this.hubConnection.off('ReceiveGroupMessage');
      this.hubConnection.off('ReceivePrivateMessage');
      this.hubConnection.off('ReceiveMessageNotification');
      this.hubConnection.off('ReceiveMessageStatusUpdate');
      this.hubConnection.off('UserTyping');
      this.hubConnection.off('UserStoppedTyping');
      this.hubConnection.off('UserPresenceChanged');
      this.hubConnection.off('ReceiveGroupMessageDeleted');
      this.hubConnection.off('ReceivePrivateMessageDeleted');
      this.hubConnection.off('ReceiveGroupMessagePinStateChanged');
      this.hubConnection.off('ReceivePrivateMessagePinStateChanged');
      this.hubConnection.off('ReceiveGroupMessageReactionsChanged');
      this.hubConnection.off('ReceivePrivateMessageReactionsChanged');

      if (this.hubConnection.state !== signalR.HubConnectionState.Disconnected) {
        await this.hubConnection.stop();
      }
    } catch (error) {
      console.error('Error disconnecting from chat SignalR hub:', error);
    } finally {
      this.hubConnection = null;
    }
  }

  async acknowledgeGroupMessageDelivered(groupId: number, messageId: number): Promise<void> {
    try {
      await this.ensureConnected();
      const signalR = await import('@microsoft/signalr');

      if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
        return;
      }

      await this.hubConnection.invoke('AcknowledgeGroupMessageDelivered', groupId.toString(), messageId);
    } catch (error) {
      console.error('Error acknowledging delivered group message:', error);
    }
  }

  async acknowledgeGroupMessageSeen(groupId: number, messageId: number): Promise<void> {
    try {
      await this.ensureConnected();
      const signalR = await import('@microsoft/signalr');

      if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
        return;
      }

      await this.hubConnection.invoke('AcknowledgeGroupMessageSeen', groupId.toString(), messageId);
    } catch (error) {
      console.error('Error acknowledging seen group message:', error);
    }
  }

  async acknowledgePrivateMessageDelivered(conversationId: number, messageId: number): Promise<void> {
    try {
      await this.ensureConnected();
      const signalR = await import('@microsoft/signalr');

      if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
        return;
      }

      await this.hubConnection.invoke('AcknowledgePrivateMessageDelivered', conversationId.toString(), messageId);
    } catch (error) {
      console.error('Error acknowledging delivered private message:', error);
    }
  }

  async acknowledgePrivateMessageSeen(conversationId: number, messageId: number): Promise<void> {
    try {
      await this.ensureConnected();
      const signalR = await import('@microsoft/signalr');

      if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
        return;
      }

      await this.hubConnection.invoke('AcknowledgePrivateMessageSeen', conversationId.toString(), messageId);
    } catch (error) {
      console.error('Error acknowledging seen private message:', error);
    }
  }

  async startTyping(type: 'group' | 'private', targetId: number): Promise<void> {
    try {
      await this.ensureConnected();
      const signalR = await import('@microsoft/signalr');

      if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
        return;
      }

      await this.hubConnection.invoke('StartTyping', type, targetId.toString());
    } catch (error) {
      console.error('Error sending typing start event:', error);
    }
  }

  async stopTyping(type: 'group' | 'private', targetId: number): Promise<void> {
    try {
      await this.ensureConnected();
      const signalR = await import('@microsoft/signalr');

      if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
        return;
      }

      await this.hubConnection.invoke('StopTyping', type, targetId.toString());
    } catch (error) {
      console.error('Error sending typing stop event:', error);
    }
  }

  private async rejoinTrackedRooms(): Promise<void> {
    const signalR = await import('@microsoft/signalr');

    if (!this.hubConnection || this.hubConnection.state !== signalR.HubConnectionState.Connected) {
      return;
    }

    for (const groupId of this.joinedGroupIds.keys()) {
      try {
        await this.hubConnection.invoke('JoinGroup', groupId.toString());
      } catch (error) {
        console.error('Error rejoining SignalR group chat room:', error);
      }
    }

    for (const conversationId of this.joinedConversationIds.keys()) {
      try {
        await this.hubConnection.invoke('JoinConversation', conversationId.toString());
      } catch (error) {
        console.error('Error rejoining SignalR private chat room:', error);
      }
    }
  }

  private clearPendingDisconnect(): void {
    if (!this.disconnectTimeoutId) {
      return;
    }

    clearTimeout(this.disconnectTimeoutId);
    this.disconnectTimeoutId = undefined;
  }

  private isConnectionClosedCancellation(error: unknown): boolean {
    return error instanceof Error
      && error.message.includes('Invocation canceled due to the underlying connection being closed');
  }

  private getBaseApiUrl(): string {
    return environment.apiUrl.replace(/\/api$/, '');
  }
}
