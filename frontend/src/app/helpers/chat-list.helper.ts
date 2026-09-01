import { createHighlightedSet, moveItemToTop, prependIfNotExists } from './dropdown-ui.helper';
import { ChatInboxItem } from '../interfaces/chat-inbox-item.model';
import { ChatInboxPreviewSource } from '../interfaces/chat-inbox-preview-source.model';
import { ChatMessageNotification } from '../interfaces/chat-message-notification.model';
import { PrivateConversation } from '../interfaces/private-chat.model';
import { GroupDetails } from '../interfaces/group.model';

export function getChatListItemKey(item: ChatInboxItem): string {
  return `${item.type}:${item.id}`;
}

export function buildPreviewSourceFromNotification(notification: ChatMessageNotification): ChatInboxPreviewSource | undefined {
  if (notification.kind === 'reaction') {
    return { kind: 'reaction', senderName: notification.senderName, reactionEmoji: notification.reactionEmoji };
  }

  if (notification.type === 'group') {
    return { kind: 'group-message', senderUserId: notification.senderUserId, senderName: notification.senderName, rawText: notification.preview };
  }

  return undefined;
}

function resolvePreviewSource(
  source: ChatInboxPreviewSource,
  currentUserId: string | null,
  translate: (key: string) => string,
): string {
  switch (source.kind) {
    case 'reaction':
      return translate('reactedToYourMessage')
        .replace('{name}', source.senderName)
        .replace('{emoji}', source.reactionEmoji ?? '');
    case 'group-message':
      return formatGroupPreviewText(source.senderUserId, source.senderName, source.rawText, currentUserId, translate);
    case 'plain-key':
      return translate(source.key);
  }
}

export function resolveChatInboxItemPreview(
  item: ChatInboxItem,
  currentUserId: string | null,
  translate: (key: string) => string,
): string {
  return item.previewSource ? resolvePreviewSource(item.previewSource, currentUserId, translate) : item.preview;
}

export function buildNotificationPreviewText(
  notification: ChatMessageNotification,
  currentUserId: string | null,
  translate: (key: string) => string,
): string {
  const source = buildPreviewSourceFromNotification(notification);
  return source ? resolvePreviewSource(source, currentUserId, translate) : notification.preview;
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
  const mergedItems = freshItems.map((item) => {
    const overlay = overlaysByKey.get(getChatListItemKey(item));

    if (!overlay || new Date(overlay.createdAt).getTime() <= new Date(item.createdAt).getTime()) {
      return item;
    }

    return {
      ...item,
      subtitle: overlay.subtitle,
      preview: overlay.preview,
      previewSource: overlay.previewSource,
      createdAt: overlay.createdAt,
      unreadCount: Math.max(item.unreadCount, overlay.unreadCount),
      isRead: item.isRead && overlay.isRead,
    };
  });

  return mergedItems.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
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
  const fallbackTitle = notification.groupName ?? `Group #${notification.groupId}`;

  return {
    type: 'group',
    id: notification.groupId ?? 0,
    title: currentGroupMatches ? (currentGroup?.name ?? fallbackTitle) : fallbackTitle,
    preview: buildNotificationPreviewText(notification, currentUserId, translate),
    previewSource: buildPreviewSourceFromNotification(notification),
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
  currentUserId: string | null,
  translate: (key: string) => string,
): ChatInboxItem {
  const currentConversationMatches = currentConversation?.id === notification.conversationId;

  return {
    type: 'private',
    id: notification.conversationId ?? 0,
    title: currentConversationMatches
      ? (currentConversation?.otherFullName || currentConversation?.otherUsername || notification.senderName)
      : notification.senderName,
    otherUserId: notification.senderUserId,
    preview: buildNotificationPreviewText(notification, currentUserId, translate),
    previewSource: buildPreviewSourceFromNotification(notification),
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
  translate: (key: string) => string;
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
    translate,
    createItem,
  } = options;

  const existingItem = items.find((item) => {
    return notification.type === 'group'
      ? item.type === 'group' && item.groupId === notification.groupId
      : item.type === 'private' && item.conversationId === notification.conversationId;
  });

  const isNewNotification = notification.isNewNotification !== false;
  const nextHighlightedKeys = new Set(highlightedKeys);

  if (!existingItem) {
    const shouldHighlight = isNewNotification && notification.senderUserId !== currentUserId && !isCurrentOpenChat;
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

  const shouldHighlight = isNewNotification && notification.senderUserId !== currentUserId && !isCurrentOpenChat;

  const updatedItem: ChatInboxItem = {
    ...existingItem,
    preview: buildNotificationPreviewText(notification, currentUserId, translate),
    previewSource: buildPreviewSourceFromNotification(notification),
    createdAt: notification.createdAt,
    isRead: isNewNotification ? !shouldHighlight : existingItem.isRead,
    unreadCount: isNewNotification && shouldHighlight ? existingItem.unreadCount + 1 : existingItem.unreadCount,
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
