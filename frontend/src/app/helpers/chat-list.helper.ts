import { createHighlightedSet, moveItemToTop, prependIfNotExists } from './dropdown-ui.helper';
import { ChatInboxItem } from '../interfaces/chat-inbox-item.model';
import { ChatMessageNotification } from '../interfaces/chat-message-notification.model';
import { PrivateConversation } from '../interfaces/private-chat.model';
import { GroupDetails } from '../interfaces/group.model';

export function getChatListItemKey(item: ChatInboxItem): string {
  return `${item.type}:${item.id}`;
}

export function buildNotificationPreviewText(
  notification: ChatMessageNotification,
  currentUserId: string | null,
  translate: (key: string) => string,
): string {
  if (notification.kind === 'reaction') {
    return translate('reactedToYourMessage')
      .replace('{name}', notification.senderName)
      .replace('{emoji}', notification.reactionEmoji ?? '');
  }

  if (notification.type === 'group') {
    return formatGroupPreviewText(notification.senderUserId, notification.senderName, notification.preview, currentUserId, translate);
  }

  return notification.preview;
}

export function formatGroupPreviewText(
  senderUserId: string,
  senderName: string,
  messageText: string,
  currentUserId: string | null,
  translate: (key: string) => string,
): string {
  const isOwnMessage = !!senderUserId && !!currentUserId && senderUserId === currentUserId;
  const displayName = isOwnMessage
    ? translate('you')
    : senderName.split(' ').filter(Boolean)[0] || senderName;

  return `${displayName}: ${messageText}`;
}

export function mergeInboxItemsWithReactionOverlays(
  freshItems: ChatInboxItem[],
  overlaysByKey: Map<string, ChatInboxItem>,
): ChatInboxItem[] {
  return freshItems.map((item) => {
    const overlay = overlaysByKey.get(getChatListItemKey(item));

    if (!overlay || new Date(overlay.createdAt).getTime() <= new Date(item.createdAt).getTime()) {
      return item;
    }

    return {
      ...item,
      subtitle: overlay.subtitle,
      preview: overlay.preview,
      createdAt: overlay.createdAt,
      unreadCount: Math.max(item.unreadCount, overlay.unreadCount),
      isRead: item.isRead && overlay.isRead,
    };
  });
}

export function createChatListHighlightedKeys(items: ChatInboxItem[]): Set<string> {
  return createHighlightedSet(
    items,
    (item) => item.unreadCount > 0,
    (item) => getChatListItemKey(item),
  );
}

export function createGroupChatListItemFromNotification(
  notification: ChatMessageNotification,
  shouldHighlight: boolean,
  currentGroup: GroupDetails | null,
  currentUserId: string | null,
  translate: (key: string) => string,
): ChatInboxItem {
  const currentGroupMatches = currentGroup?.id === notification.groupId;

  return {
    type: 'group',
    id: notification.groupId ?? 0,
    title: currentGroupMatches ? (currentGroup?.name ?? `Group #${notification.groupId}`) : `Group #${notification.groupId}`,
    preview: buildNotificationPreviewText(notification, currentUserId, translate),
    createdAt: notification.createdAt,
    unreadCount: shouldHighlight ? 1 : 0,
    isRead: !shouldHighlight,
    imageUrl: currentGroupMatches ? (currentGroup?.imageUrl ?? null) : null,
    fallbackIcon: 'bi-people',
    groupId: notification.groupId ?? undefined,
  };
}

export function createPrivateChatListItemFromNotification(
  notification: ChatMessageNotification,
  shouldHighlight: boolean,
  currentConversation: PrivateConversation | null,
): ChatInboxItem {
  const currentConversationMatches = currentConversation?.id === notification.conversationId;

  return {
    type: 'private',
    id: notification.conversationId ?? 0,
    title: currentConversationMatches
      ? (currentConversation?.otherFullName || currentConversation?.otherUsername || notification.senderName)
      : notification.senderName,
    otherUserId: notification.senderUserId,
    preview: notification.preview,
    createdAt: notification.createdAt,
    unreadCount: shouldHighlight ? 1 : 0,
    isRead: !shouldHighlight,
    imageUrl: currentConversationMatches ? (currentConversation?.otherProfilePictureUrl ?? null) : null,
    fallbackIcon: 'bi-person',
    conversationId: notification.conversationId ?? undefined,
  };
}

export interface ApplyRealtimeChatListNotificationOptions {
  items: ChatInboxItem[];
  highlightedKeys: Set<string>;
  notification: ChatMessageNotification;
  currentUserId: string | null;
  isCurrentOpenChat: boolean;
  createItem: (notification: ChatMessageNotification, shouldHighlight: boolean) => ChatInboxItem;
}

export function applyRealtimeChatListNotification(
  options: ApplyRealtimeChatListNotificationOptions,
): { items: ChatInboxItem[]; highlightedKeys: Set<string> } {
  const {
    items,
    highlightedKeys,
    notification,
    currentUserId,
    isCurrentOpenChat,
    createItem,
  } = options;

  const existingItem = items.find((item) => {
    return notification.type === 'group'
      ? item.type === 'group' && item.groupId === notification.groupId
      : item.type === 'private' && item.conversationId === notification.conversationId;
  });

  const shouldHighlight = notification.senderUserId !== currentUserId && !isCurrentOpenChat;
  const nextHighlightedKeys = new Set(highlightedKeys);

  if (!existingItem) {
    const newItem = createItem(notification, shouldHighlight);
    const nextItems = prependIfNotExists(
      items,
      newItem,
      (item) => getChatListItemKey(item) === getChatListItemKey(newItem),
    );

    if (shouldHighlight) {
      nextHighlightedKeys.add(getChatListItemKey(newItem));
    }

    return {
      items: nextItems,
      highlightedKeys: nextHighlightedKeys,
    };
  }

  const updatedItem: ChatInboxItem = {
    ...existingItem,
    preview: notification.preview,
    createdAt: notification.createdAt,
    isRead: !shouldHighlight,
    unreadCount: shouldHighlight ? existingItem.unreadCount + 1 : existingItem.unreadCount,
  };

  const nextItems = moveItemToTop(
    items,
    updatedItem,
    (item) => getChatListItemKey(item) === getChatListItemKey(existingItem),
  );

  if (shouldHighlight) {
    nextHighlightedKeys.add(getChatListItemKey(updatedItem));
  }

  return {
    items: nextItems,
    highlightedKeys: nextHighlightedKeys,
  };
}
