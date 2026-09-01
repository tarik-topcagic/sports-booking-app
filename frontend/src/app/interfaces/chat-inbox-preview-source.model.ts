export type ChatInboxPreviewSource =
  | { kind: 'reaction'; senderName: string; reactionEmoji?: string }
  | { kind: 'group-message'; senderUserId: string; senderName: string; rawText: string }
  | { kind: 'plain-key'; key: string };
