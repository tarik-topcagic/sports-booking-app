using Microsoft.AspNetCore.SignalR;
using SportsBookingAPI.Hubs;
using SportsBookingAPI.DTOs;
using SportsBookingAPI.Helpers;
using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Services
{
    public class PrivateChatService : IPrivateChatService
    {
        private readonly IPrivateChatRepository _privateChatRepository;
        private readonly IHubContext<ChatHub> _hubContext;

        public PrivateChatService(
            IPrivateChatRepository privateChatRepository,
            IHubContext<ChatHub> hubContext)
        {
            _privateChatRepository = privateChatRepository;
            _hubContext = hubContext;
        }

        public async Task<ServiceResult> GetConversationsAsync(string userId)
        {
            var conversations = await _privateChatRepository.GetConversationsForUserAsync(userId);
            return ServiceResult.Ok(conversations.Select(conversation => ToPrivateConversationDto(conversation, userId)));
        }

        public async Task<ServiceResult> GetConversationMessagesAsync(string userId, int conversationId)
        {
            var conversation = await _privateChatRepository.GetConversationByIdAsync(conversationId);
            if (conversation == null)
                return ServiceResult.NotFound("Conversation not found");

            if (!IsConversationParticipant(conversation, userId))
                return ServiceResult.Forbid("Only conversation participants can access private messages");

            var seenChanges = await _privateChatRepository.MarkMessagesSeenForConversationAsync(conversationId, userId, DateTime.UtcNow);
            var messages = await _privateChatRepository.GetMessagesForConversationAsync(conversationId);
            await BroadcastStatusUpdatesAsync(conversationId, seenChanges);
            return ServiceResult.Ok(messages.Select(ToPrivateMessageDto));
        }

        public async Task<ServiceResult> GetOrCreateConversationAsync(string currentUserId, string targetUserId)
        {
            if (currentUserId == targetUserId)
                return ServiceResult.BadRequest("You cannot start a private conversation with yourself");

            var targetUser = await _privateChatRepository.GetUserByIdAsync(targetUserId);
            if (targetUser == null)
                return ServiceResult.NotFound("Target user not found");

            var conversation = await GetOrCreateConversationEntityAsync(currentUserId, targetUserId);
            return ServiceResult.Ok(ToPrivateConversationDto(conversation, currentUserId));
        }

        public async Task<ServiceResult> CreateMessageForUserAsync(string senderUserId, string targetUserId, CreatePrivateMessageDto createPrivateMessageDto)
        {
            if (senderUserId == targetUserId)
                return ServiceResult.BadRequest("You cannot send a private message to yourself");

            var targetUser = await _privateChatRepository.GetUserByIdAsync(targetUserId);
            if (targetUser == null)
                return ServiceResult.NotFound("Target user not found");

            var trimmedMessageText = createPrivateMessageDto.MessageText?.Trim();
            if (string.IsNullOrWhiteSpace(trimmedMessageText))
                return ServiceResult.BadRequest("Message text is required");

            var conversation = await GetOrCreateConversationEntityAsync(senderUserId, targetUserId);

            int? replyToMessageId = null;
            if (createPrivateMessageDto.ReplyToMessageId.HasValue)
            {
                var replyToMessage = await _privateChatRepository.GetMessageByIdAsync(conversation.Id, createPrivateMessageDto.ReplyToMessageId.Value);
                if (replyToMessage != null)
                {
                    replyToMessageId = replyToMessage.Id;
                }
            }

            var message = new PrivateMessage
            {
                ConversationId = conversation.Id,
                SenderUserId = senderUserId,
                MessageText = trimmedMessageText,
                CreatedAt = DateTime.UtcNow,
                ReplyToMessageId = replyToMessageId
            };

            var createdMessage = await _privateChatRepository.CreateMessageAsync(message);
            var messageDto = ToPrivateMessageDto(createdMessage);

            await _hubContext.Clients
                .Group(ChatHub.GetConversationChannelName(conversation.Id.ToString()))
                .SendAsync("ReceivePrivateMessage", messageDto);

            var notificationDto = new ChatMessageNotificationDto
            {
                Type = "private",
                GroupId = null,
                ConversationId = conversation.Id,
                SenderUserId = messageDto.SenderUserId,
                SenderName = messageDto.SenderFullName,
                Preview = messageDto.MessageText,
                CreatedAt = messageDto.CreatedAt
            };

            foreach (var recipientUserId in GetConversationNotificationRecipientUserIds(conversation, senderUserId, targetUserId))
            {
                await _hubContext.Clients
                    .User(recipientUserId)
                    .SendAsync("ReceiveMessageNotification", notificationDto);
            }

            return ServiceResult.Ok(messageDto);
        }

        public async Task AcknowledgeMessageDeliveredAsync(string userId, int conversationId, int messageId)
        {
            var change = await _privateChatRepository.MarkMessageDeliveredAsync(conversationId, messageId, userId, DateTime.UtcNow);
            await BroadcastStatusUpdateAsync(conversationId, change);
        }

        public async Task AcknowledgeMessageSeenAsync(string userId, int conversationId, int messageId)
        {
            var changes = await _privateChatRepository.MarkMessageSeenAsync(conversationId, messageId, userId, DateTime.UtcNow);
            await BroadcastStatusUpdatesAsync(conversationId, changes);
        }

        public async Task<ServiceResult> CreateMessageForConversationAsync(string senderUserId, int conversationId, CreatePrivateMessageDto createPrivateMessageDto)
        {
            var conversation = await _privateChatRepository.GetConversationByIdAsync(conversationId);
            if (conversation == null)
                return ServiceResult.NotFound("Conversation not found");

            if (!IsConversationParticipant(conversation, senderUserId))
                return ServiceResult.Forbid("Only conversation participants can send private messages");

            var trimmedMessageText = createPrivateMessageDto.MessageText?.Trim();
            if (string.IsNullOrWhiteSpace(trimmedMessageText))
                return ServiceResult.BadRequest("Message text is required");

            int? replyToMessageId = null;
            if (createPrivateMessageDto.ReplyToMessageId.HasValue)
            {
                var replyToMessage = await _privateChatRepository.GetMessageByIdAsync(conversation.Id, createPrivateMessageDto.ReplyToMessageId.Value);
                if (replyToMessage != null)
                {
                    replyToMessageId = replyToMessage.Id;
                }
            }

            var message = new PrivateMessage
            {
                ConversationId = conversation.Id,
                SenderUserId = senderUserId,
                MessageText = trimmedMessageText,
                CreatedAt = DateTime.UtcNow,
                ReplyToMessageId = replyToMessageId
            };

            var createdMessage = await _privateChatRepository.CreateMessageAsync(message);
            var messageDto = ToPrivateMessageDto(createdMessage);

            await _hubContext.Clients
                .Group(ChatHub.GetConversationChannelName(conversation.Id.ToString()))
                .SendAsync("ReceivePrivateMessage", messageDto);

            var notificationDto = new ChatMessageNotificationDto
            {
                Type = "private",
                GroupId = null,
                ConversationId = conversation.Id,
                SenderUserId = messageDto.SenderUserId,
                SenderName = messageDto.SenderFullName,
                Preview = messageDto.MessageText,
                CreatedAt = messageDto.CreatedAt
            };

            foreach (var recipientUserId in GetConversationNotificationRecipientUserIds(conversation))
            {
                await _hubContext.Clients
                    .User(recipientUserId)
                    .SendAsync("ReceiveMessageNotification", notificationDto);
            }

            return ServiceResult.Ok(messageDto);
        }

        public async Task<ServiceResult> DeletePrivateMessageAsync(string userId, int conversationId, int messageId)
        {
            var conversation = await _privateChatRepository.GetConversationByIdAsync(conversationId);
            if (conversation == null)
                return ServiceResult.NotFound("Conversation not found");

            if (!IsConversationParticipant(conversation, userId))
                return ServiceResult.Forbid("Only conversation participants can access private messages");

            var message = await _privateChatRepository.GetMessageByIdAsync(conversationId, messageId);
            if (message == null)
                return ServiceResult.NotFound("Message not found");

            if (message.SenderUserId != userId)
                return ServiceResult.Forbid("Only the sender can unsend this message");

            await _privateChatRepository.SoftDeleteMessageAsync(message);

            var newLatestMessage = await _privateChatRepository.GetLatestNonDeletedMessageAsync(conversationId);

            await _hubContext.Clients
                .Group(ChatHub.GetConversationChannelName(conversationId.ToString()))
                .SendAsync("ReceivePrivateMessageDeleted", new MessageDeletedDto
                {
                    MessageId = messageId,
                    GroupId = null,
                    ConversationId = conversationId,
                    IsChatNowEmpty = newLatestMessage == null,
                    UpdatedPreviewText = newLatestMessage?.MessageText,
                    UpdatedPreviewCreatedAt = newLatestMessage != null
                        ? BosniaTimeHelper.ToSarajevoOffset(newLatestMessage.CreatedAt)
                        : null
                });

            return ServiceResult.Ok();
        }

        public async Task<ServiceResult> SetPrivateMessagePinnedAsync(string userId, int conversationId, int messageId, bool isPinned)
        {
            var conversation = await _privateChatRepository.GetConversationByIdAsync(conversationId);
            if (conversation == null)
                return ServiceResult.NotFound("Conversation not found");

            if (!IsConversationParticipant(conversation, userId))
                return ServiceResult.Forbid("Only conversation participants can access private messages");

            var message = await _privateChatRepository.GetMessageByIdAsync(conversationId, messageId);
            if (message == null)
                return ServiceResult.NotFound("Message not found");

            var pinnedAt = isPinned ? DateTime.UtcNow : (DateTime?)null;
            await _privateChatRepository.SetMessagePinnedAsync(message, isPinned, pinnedAt);

            var pinnedAtOffset = pinnedAt.HasValue ? BosniaTimeHelper.ToSarajevoOffset(pinnedAt.Value) : (DateTimeOffset?)null;

            await _hubContext.Clients
                .Group(ChatHub.GetConversationChannelName(conversationId.ToString()))
                .SendAsync("ReceivePrivateMessagePinStateChanged", new MessagePinStateChangedDto
                {
                    MessageId = messageId,
                    GroupId = null,
                    ConversationId = conversationId,
                    IsPinned = isPinned,
                    PinnedAt = pinnedAtOffset
                });

            return ServiceResult.Ok(new { isPinned, pinnedAt = pinnedAtOffset });
        }

        public async Task<ServiceResult> AddOrUpdatePrivateMessageReactionAsync(string userId, int conversationId, int messageId, string emoji)
        {
            var conversation = await _privateChatRepository.GetConversationByIdAsync(conversationId);
            if (conversation == null)
                return ServiceResult.NotFound("Conversation not found");

            if (!IsConversationParticipant(conversation, userId))
                return ServiceResult.Forbid("Only conversation participants can access private messages");

            var trimmedEmoji = emoji?.Trim();
            if (string.IsNullOrWhiteSpace(trimmedEmoji))
                return ServiceResult.BadRequest("Emoji is required");

            var message = await _privateChatRepository.GetMessageByIdAsync(conversationId, messageId);
            if (message == null)
                return ServiceResult.NotFound("Message not found");

            var reactions = await _privateChatRepository.AddOrUpdateReactionAsync(messageId, userId, trimmedEmoji);
            var reactionDtos = ToMessageReactionDtos(reactions);

            await _hubContext.Clients
                .Group(ChatHub.GetConversationChannelName(conversationId.ToString()))
                .SendAsync("ReceivePrivateMessageReactionsChanged", new MessageReactionsChangedDto
                {
                    MessageId = messageId,
                    GroupId = null,
                    ConversationId = conversationId,
                    Reactions = reactionDtos
                });

            if (message.SenderUserId != userId)
            {
                var isNewNotification = await _privateChatRepository.ShouldTreatReactionAsNewNotificationAsync(messageId, userId);
                var reactorReaction = reactions.FirstOrDefault(reaction => reaction.UserId == userId);
                var reactorName = reactorReaction != null
                    ? (!string.IsNullOrWhiteSpace(reactorReaction.User?.FullName)
                        ? reactorReaction.User.FullName
                        : reactorReaction.User?.UserName ?? string.Empty)
                    : string.Empty;

                await _hubContext.Clients
                    .User(message.SenderUserId)
                    .SendAsync("ReceiveMessageNotification", new ChatMessageNotificationDto
                    {
                        Type = "private",
                        GroupId = null,
                        ConversationId = conversationId,
                        SenderUserId = userId,
                        SenderName = reactorName,
                        Preview = $"{trimmedEmoji} Reacted to your message",
                        CreatedAt = BosniaTimeHelper.ToSarajevoOffset(DateTime.UtcNow),
                        Kind = "reaction",
                        ReactionEmoji = trimmedEmoji,
                        IsNewNotification = isNewNotification
                    });
            }

            return ServiceResult.Ok(reactionDtos);
        }

        public async Task<ServiceResult> RemovePrivateMessageReactionAsync(string userId, int conversationId, int messageId)
        {
            var conversation = await _privateChatRepository.GetConversationByIdAsync(conversationId);
            if (conversation == null)
                return ServiceResult.NotFound("Conversation not found");

            if (!IsConversationParticipant(conversation, userId))
                return ServiceResult.Forbid("Only conversation participants can access private messages");

            var message = await _privateChatRepository.GetMessageByIdAsync(conversationId, messageId);
            if (message == null)
                return ServiceResult.NotFound("Message not found");

            var reactions = await _privateChatRepository.RemoveReactionAsync(messageId, userId);
            var reactionDtos = ToMessageReactionDtos(reactions);

            await _hubContext.Clients
                .Group(ChatHub.GetConversationChannelName(conversationId.ToString()))
                .SendAsync("ReceivePrivateMessageReactionsChanged", new MessageReactionsChangedDto
                {
                    MessageId = messageId,
                    GroupId = null,
                    ConversationId = conversationId,
                    Reactions = reactionDtos
                });

            return ServiceResult.Ok(reactionDtos);
        }

        private static bool IsConversationParticipant(PrivateConversation conversation, string userId)
        {
            return conversation.UserOneId == userId || conversation.UserTwoId == userId;
        }

        private static IReadOnlyList<string> GetConversationNotificationRecipientUserIds(
            PrivateConversation conversation,
            params string[] fallbackUserIds)
        {
            var conversationUserIds = new[] { conversation.UserOneId, conversation.UserTwoId }
                .Where(userId => !string.IsNullOrWhiteSpace(userId));

            var resolvedUserIds = conversationUserIds.Any()
                ? conversationUserIds
                : fallbackUserIds.Where(userId => !string.IsNullOrWhiteSpace(userId));

            return resolvedUserIds
                .Distinct()
                .ToList();
        }

        private async Task<PrivateConversation> GetOrCreateConversationEntityAsync(string firstUserId, string secondUserId)
        {
            var (userOneId, userTwoId) = NormalizeUserPair(firstUserId, secondUserId);

            var conversation = await _privateChatRepository.GetConversationBetweenUsersAsync(userOneId, userTwoId);
            if (conversation != null)
                return conversation;

            return await _privateChatRepository.CreateConversationAsync(new PrivateConversation
            {
                UserOneId = userOneId,
                UserTwoId = userTwoId,
                CreatedAt = DateTime.UtcNow
            });
        }

        private static (string UserOneId, string UserTwoId) NormalizeUserPair(string firstUserId, string secondUserId)
        {
            return string.CompareOrdinal(firstUserId, secondUserId) <= 0
                ? (firstUserId, secondUserId)
                : (secondUserId, firstUserId);
        }

        private static PrivateConversationDto ToPrivateConversationDto(PrivateConversation conversation, string currentUserId)
        {
            var otherUser = conversation.UserOneId == currentUserId
                ? conversation.UserTwo
                : conversation.UserOne;

            var latestMessage = conversation.PrivateMessages
                .OrderByDescending(message => message.CreatedAt)
                .FirstOrDefault();

            return new PrivateConversationDto
            {
                Id = conversation.Id,
                OtherUserId = otherUser?.Id ?? string.Empty,
                OtherUsername = otherUser?.UserName ?? string.Empty,
                OtherFullName = !string.IsNullOrWhiteSpace(otherUser?.FullName)
                    ? otherUser.FullName
                    : otherUser?.UserName ?? string.Empty,
                OtherProfilePictureUrl = otherUser?.ProfilePictureUrl ?? "default-profile.png",
                LatestMessagePreview = latestMessage?.MessageText,
                LatestMessageCreatedAt = latestMessage?.CreatedAt,
                CreatedAt = conversation.CreatedAt
            };
        }

        private static PrivateMessageDto ToPrivateMessageDto(PrivateMessage message)
        {
            return new PrivateMessageDto
            {
                Id = message.Id,
                ConversationId = message.ConversationId,
                SenderUserId = message.SenderUserId,
                SenderUsername = message.SenderUser?.UserName ?? string.Empty,
                SenderFullName = !string.IsNullOrWhiteSpace(message.SenderUser?.FullName)
                    ? message.SenderUser.FullName
                    : message.SenderUser?.UserName ?? string.Empty,
                SenderProfilePictureUrl = message.SenderUser?.ProfilePictureUrl ?? "default-profile.png",
                MessageText = message.MessageText,
                CreatedAt = BosniaTimeHelper.ToSarajevoOffset(message.CreatedAt),
                DeliveredAt = message.DeliveredAt.HasValue ? BosniaTimeHelper.ToSarajevoOffset(message.DeliveredAt.Value) : null,
                SeenAt = message.SeenAt.HasValue ? BosniaTimeHelper.ToSarajevoOffset(message.SeenAt.Value) : null,
                IsPinned = message.IsPinned,
                PinnedAt = message.PinnedAt.HasValue ? BosniaTimeHelper.ToSarajevoOffset(message.PinnedAt.Value) : null,
                ReplyToMessageId = message.ReplyToMessageId,
                ReplyToSenderUserId = message.ReplyToMessage?.SenderUserId,
                ReplyToSenderName = message.ReplyToMessage != null
                    ? (!string.IsNullOrWhiteSpace(message.ReplyToMessage.SenderUser?.FullName)
                        ? message.ReplyToMessage.SenderUser.FullName
                        : message.ReplyToMessage.SenderUser?.UserName ?? string.Empty)
                    : null,
                ReplyToMessageTextPreview = message.ReplyToMessage != null && !message.ReplyToMessage.IsDeleted
                    ? TruncateMessagePreview(message.ReplyToMessage.MessageText)
                    : null,
                ReplyToIsDeleted = message.ReplyToMessage?.IsDeleted ?? false,
                Reactions = ToMessageReactionDtos(message.Reactions.OrderBy(reaction => reaction.CreatedAt))
            };
        }

        private static List<MessageReactionDto> ToMessageReactionDtos(IEnumerable<PrivateMessageReaction> reactions)
        {
            return reactions
                .Select(reaction => new MessageReactionDto
                {
                    UserId = reaction.UserId,
                    UserName = !string.IsNullOrWhiteSpace(reaction.User?.FullName)
                        ? reaction.User.FullName
                        : reaction.User?.UserName ?? string.Empty,
                    Emoji = reaction.Emoji
                })
                .ToList();
        }

        private static string TruncateMessagePreview(string text, int maxLength = 120)
        {
            if (string.IsNullOrEmpty(text) || text.Length <= maxLength)
                return text;

            return text[..maxLength].TrimEnd() + "…";
        }

        private async Task BroadcastStatusUpdatesAsync(int conversationId, IReadOnlyList<MessageStatusChange> changes)
        {
            foreach (var change in changes)
            {
                await BroadcastStatusUpdateAsync(conversationId, change);
            }
        }

        private async Task BroadcastStatusUpdateAsync(int conversationId, MessageStatusChange? change)
        {
            if (change == null)
                return;

            await _hubContext.Clients
                .Group(ChatHub.GetConversationChannelName(conversationId.ToString()))
                .SendAsync("ReceiveMessageStatusUpdate", new ChatMessageStatusUpdateDto
                {
                    MessageId = change.MessageId,
                    ChatType = "private",
                    GroupId = null,
                    ConversationId = conversationId,
                    UserId = change.UserId,
                    DeliveredAt = change.DeliveredAt.HasValue ? BosniaTimeHelper.ToSarajevoOffset(change.DeliveredAt.Value) : null,
                    SeenAt = change.SeenAt.HasValue ? BosniaTimeHelper.ToSarajevoOffset(change.SeenAt.Value) : null
                });
        }
    }
}
