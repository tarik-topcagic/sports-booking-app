using Microsoft.AspNetCore.SignalR;
using SportsBookingAPI.Hubs;
using SportsBookingAPI.DTOs;
using SportsBookingAPI.Helpers;
using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Services
{
    public class GroupChatService : IGroupChatService
    {
        private readonly IGroupRepository _groupRepository;
        private readonly IGroupChatRepository _groupChatRepository;
        private readonly IHubContext<ChatHub> _hubContext;

        public GroupChatService(
            IGroupRepository groupRepository,
            IGroupChatRepository groupChatRepository,
            IHubContext<ChatHub> hubContext)
        {
            _groupRepository = groupRepository;
            _groupChatRepository = groupChatRepository;
            _hubContext = hubContext;
        }

        public async Task<ServiceResult> GetGroupMessagesAsync(string userId, int groupId)
        {
            var group = await _groupRepository.GetGroupByIdAsync(groupId);
            if (group == null)
                return ServiceResult.NotFound("Group not found");

            if (!CanAccessGroupChat(group, userId))
                return ServiceResult.Forbid("Only accepted group members and admin can access group chat");

            var seenChanges = await _groupChatRepository.MarkMessagesSeenForGroupAsync(groupId, userId, DateTime.UtcNow);
            var messages = await _groupChatRepository.GetMessagesForGroupAsync(groupId);
            await BroadcastStatusUpdatesAsync(groupId, null, "group", seenChanges);
            return ServiceResult.Ok(messages.Select(ToGroupMessageDto));
        }

        public async Task<ServiceResult> CreateGroupMessageAsync(string userId, int groupId, CreateGroupMessageDto createGroupMessageDto)
        {
            var group = await _groupRepository.GetGroupByIdAsync(groupId);
            if (group == null)
                return ServiceResult.NotFound("Group not found");

            if (!CanAccessGroupChat(group, userId))
                return ServiceResult.Forbid("Only accepted group members and admin can send group chat messages");

            var trimmedMessageText = createGroupMessageDto.MessageText?.Trim();
            if (string.IsNullOrWhiteSpace(trimmedMessageText))
                return ServiceResult.BadRequest("Message text is required");

            int? replyToMessageId = null;
            if (createGroupMessageDto.ReplyToMessageId.HasValue)
            {
                var replyToMessage = await _groupChatRepository.GetMessageByIdAsync(groupId, createGroupMessageDto.ReplyToMessageId.Value);
                if (replyToMessage != null)
                {
                    replyToMessageId = replyToMessage.Id;
                }
            }

            var message = new GroupMessage
            {
                GroupId = groupId,
                SenderUserId = userId,
                MessageText = trimmedMessageText,
                CreatedAt = DateTime.UtcNow,
                ReplyToMessageId = replyToMessageId
            };

            var createdMessage = await _groupChatRepository.CreateMessageAsync(message);
            await _groupChatRepository.CreateMessageReceiptsAsync(GetGroupMessageReceipts(group, createdMessage.Id, userId));
            var messageDto = ToGroupMessageDto(createdMessage);

            await _hubContext.Clients
                .Group(ChatHub.GetGroupChannelName(groupId.ToString()))
                .SendAsync("ReceiveGroupMessage", messageDto);

            var notificationDto = new ChatMessageNotificationDto
            {
                Type = "group",
                GroupId = groupId,
                GroupName = group.Name,
                ConversationId = null,
                SenderUserId = messageDto.SenderUserId,
                SenderName = messageDto.SenderFullName,
                Preview = messageDto.MessageText,
                CreatedAt = messageDto.CreatedAt
            };

            foreach (var recipientUserId in GetGroupNotificationRecipientUserIds(group))
            {
                await _hubContext.Clients
                    .User(recipientUserId)
                    .SendAsync("ReceiveMessageNotification", notificationDto);
            }

            return ServiceResult.Ok(messageDto);
        }

        public async Task AcknowledgeMessageDeliveredAsync(string userId, int groupId, int messageId)
        {
            if (!await _groupChatRepository.IsGroupChatParticipantAsync(groupId, userId))
                return;

            var change = await _groupChatRepository.MarkMessageDeliveredAsync(groupId, messageId, userId, DateTime.UtcNow);
            await BroadcastStatusUpdateAsync(groupId, null, "group", change);
        }

        public async Task AcknowledgeMessageSeenAsync(string userId, int groupId, int messageId)
        {
            if (!await _groupChatRepository.IsGroupChatParticipantAsync(groupId, userId))
                return;

            var changes = await _groupChatRepository.MarkMessageSeenAsync(groupId, messageId, userId, DateTime.UtcNow);
            await BroadcastStatusUpdatesAsync(groupId, null, "group", changes);
        }

        public async Task<ServiceResult> DeleteGroupMessageAsync(string userId, int groupId, int messageId)
        {
            var group = await _groupRepository.GetGroupByIdAsync(groupId);
            if (group == null)
                return ServiceResult.NotFound("Group not found");

            if (!CanAccessGroupChat(group, userId))
                return ServiceResult.Forbid("Only accepted group members and admin can access group chat");

            var message = await _groupChatRepository.GetMessageByIdAsync(groupId, messageId);
            if (message == null)
                return ServiceResult.NotFound("Message not found");

            if (message.SenderUserId != userId)
                return ServiceResult.Forbid("Only the sender can unsend this message");

            await _groupChatRepository.SoftDeleteMessageAsync(message);

            var newLatestMessage = await _groupChatRepository.GetLatestNonDeletedMessageAsync(groupId);
            var newLatestSenderName = newLatestMessage != null
                ? (!string.IsNullOrWhiteSpace(newLatestMessage.SenderUser?.FullName)
                    ? newLatestMessage.SenderUser.FullName
                    : newLatestMessage.SenderUser?.UserName ?? string.Empty)
                : null;

            await _hubContext.Clients
                .Group(ChatHub.GetGroupChannelName(groupId.ToString()))
                .SendAsync("ReceiveGroupMessageDeleted", new MessageDeletedDto
                {
                    MessageId = messageId,
                    GroupId = groupId,
                    ConversationId = null,
                    IsChatNowEmpty = newLatestMessage == null,
                    UpdatedPreviewText = newLatestMessage?.MessageText,
                    UpdatedPreviewCreatedAt = newLatestMessage != null
                        ? BosniaTimeHelper.ToSarajevoOffset(newLatestMessage.CreatedAt)
                        : null,
                    UpdatedPreviewSenderUserId = newLatestMessage?.SenderUserId,
                    UpdatedPreviewSenderName = newLatestSenderName
                });

            return ServiceResult.Ok();
        }

        public async Task<ServiceResult> SetGroupMessagePinnedAsync(string userId, int groupId, int messageId, bool isPinned)
        {
            var group = await _groupRepository.GetGroupByIdAsync(groupId);
            if (group == null)
                return ServiceResult.NotFound("Group not found");

            if (!CanAccessGroupChat(group, userId))
                return ServiceResult.Forbid("Only accepted group members and admin can access group chat");

            var message = await _groupChatRepository.GetMessageByIdAsync(groupId, messageId);
            if (message == null)
                return ServiceResult.NotFound("Message not found");

            var pinnedAt = isPinned ? DateTime.UtcNow : (DateTime?)null;
            await _groupChatRepository.SetMessagePinnedAsync(message, isPinned, pinnedAt);

            var pinnedAtOffset = pinnedAt.HasValue ? BosniaTimeHelper.ToSarajevoOffset(pinnedAt.Value) : (DateTimeOffset?)null;

            await _hubContext.Clients
                .Group(ChatHub.GetGroupChannelName(groupId.ToString()))
                .SendAsync("ReceiveGroupMessagePinStateChanged", new MessagePinStateChangedDto
                {
                    MessageId = messageId,
                    GroupId = groupId,
                    ConversationId = null,
                    IsPinned = isPinned,
                    PinnedAt = pinnedAtOffset
                });

            return ServiceResult.Ok(new { isPinned, pinnedAt = pinnedAtOffset });
        }

        public async Task<ServiceResult> AddOrUpdateGroupMessageReactionAsync(string userId, int groupId, int messageId, string emoji)
        {
            var group = await _groupRepository.GetGroupByIdAsync(groupId);
            if (group == null)
                return ServiceResult.NotFound("Group not found");

            if (!CanAccessGroupChat(group, userId))
                return ServiceResult.Forbid("Only accepted group members and admin can access group chat");

            var trimmedEmoji = emoji?.Trim();
            if (string.IsNullOrWhiteSpace(trimmedEmoji))
                return ServiceResult.BadRequest("Emoji is required");

            var message = await _groupChatRepository.GetMessageByIdAsync(groupId, messageId);
            if (message == null)
                return ServiceResult.NotFound("Message not found");

            var reactions = await _groupChatRepository.AddOrUpdateReactionAsync(messageId, userId, trimmedEmoji);
            var reactionDtos = ToMessageReactionDtos(reactions);

            await _hubContext.Clients
                .Group(ChatHub.GetGroupChannelName(groupId.ToString()))
                .SendAsync("ReceiveGroupMessageReactionsChanged", new MessageReactionsChangedDto
                {
                    MessageId = messageId,
                    GroupId = groupId,
                    ConversationId = null,
                    Reactions = reactionDtos
                });

            if (message.SenderUserId != userId && CanAccessGroupChat(group, message.SenderUserId))
            {
                var isNewNotification = await _groupChatRepository.ShouldTreatReactionAsNewNotificationAsync(messageId, userId);
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
                        Type = "group",
                        GroupId = groupId,
                        GroupName = group.Name,
                        ConversationId = null,
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

        public async Task<ServiceResult> RemoveGroupMessageReactionAsync(string userId, int groupId, int messageId)
        {
            var group = await _groupRepository.GetGroupByIdAsync(groupId);
            if (group == null)
                return ServiceResult.NotFound("Group not found");

            if (!CanAccessGroupChat(group, userId))
                return ServiceResult.Forbid("Only accepted group members and admin can access group chat");

            var message = await _groupChatRepository.GetMessageByIdAsync(groupId, messageId);
            if (message == null)
                return ServiceResult.NotFound("Message not found");

            var reactions = await _groupChatRepository.RemoveReactionAsync(messageId, userId);
            var reactionDtos = ToMessageReactionDtos(reactions);

            await _hubContext.Clients
                .Group(ChatHub.GetGroupChannelName(groupId.ToString()))
                .SendAsync("ReceiveGroupMessageReactionsChanged", new MessageReactionsChangedDto
                {
                    MessageId = messageId,
                    GroupId = groupId,
                    ConversationId = null,
                    Reactions = reactionDtos
                });

            return ServiceResult.Ok(reactionDtos);
        }

        private static bool CanAccessGroupChat(Group group, string userId)
        {
            return group.AdminId == userId
                || group.Memberships.Any(membership =>
                    membership.UserId == userId
                    && membership.Status == MembershipStatus.Accepted);
        }

        private static IReadOnlyList<string> GetGroupNotificationRecipientUserIds(Group group)
        {
            return group.Memberships
                .Where(membership => membership.Status == MembershipStatus.Accepted)
                .Select(membership => membership.UserId)
                .Append(group.AdminId)
                .Where(userId => !string.IsNullOrWhiteSpace(userId))
                .Distinct()
                .ToList();
        }

        private static IReadOnlyList<GroupMessageReceipt> GetGroupMessageReceipts(Group group, int messageId, string senderUserId)
        {
            return group.Memberships
                .Where(membership =>
                    membership.Status == MembershipStatus.Accepted
                    && membership.UserId != senderUserId)
                .Select(membership => new GroupMessageReceipt
                {
                    GroupMessageId = messageId,
                    UserId = membership.UserId
                })
                .Append(group.AdminId != senderUserId
                    ? new GroupMessageReceipt
                    {
                        GroupMessageId = messageId,
                        UserId = group.AdminId
                    }
                    : null)
                .Where(receipt => receipt != null)
                .Cast<GroupMessageReceipt>()
                .GroupBy(receipt => receipt.UserId)
                .Select(groupedReceipts => groupedReceipts.First())
                .ToList();
        }

        private static GroupMessageDto ToGroupMessageDto(GroupMessage message)
        {
            var seenReceipts = GetSeenReceipts(message);

            return new GroupMessageDto
            {
                Id = message.Id,
                GroupId = message.GroupId,
                SenderUserId = message.SenderUserId,
                SenderUsername = message.SenderUser?.UserName ?? string.Empty,
                SenderFullName = !string.IsNullOrWhiteSpace(message.SenderUser?.FullName)
                    ? message.SenderUser.FullName
                    : message.SenderUser?.UserName ?? string.Empty,
                SenderProfilePictureUrl = message.SenderUser?.ProfilePictureUrl ?? "default-profile.png",
                MessageText = message.MessageText,
                CreatedAt = BosniaTimeHelper.ToSarajevoOffset(message.CreatedAt),
                DeliveredAt = message.Receipts
                    .Where(receipt => receipt.DeliveredAt.HasValue)
                    .Select(receipt => (DateTime?)receipt.DeliveredAt)
                    .OrderBy(deliveredAt => deliveredAt)
                    .Select(deliveredAt => deliveredAt.HasValue ? BosniaTimeHelper.ToSarajevoOffset(deliveredAt.Value) : (DateTimeOffset?)null)
                    .FirstOrDefault(),
                SeenAt = message.Receipts
                    .Where(receipt => receipt.SeenAt.HasValue)
                    .Select(receipt => (DateTime?)receipt.SeenAt)
                    .OrderBy(seenAt => seenAt)
                    .Select(seenAt => seenAt.HasValue ? BosniaTimeHelper.ToSarajevoOffset(seenAt.Value) : (DateTimeOffset?)null)
                    .FirstOrDefault(),
                SeenByUserIds = seenReceipts
                    .Select(receipt => receipt.UserId)
                    .ToList(),
                SeenByUserNames = seenReceipts
                    .Select(receipt => !string.IsNullOrWhiteSpace(receipt.User?.FullName)
                        ? receipt.User.FullName
                        : receipt.User?.UserName ?? string.Empty)
                    .Where(name => !string.IsNullOrWhiteSpace(name))
                    .ToList(),
                SeenByUserProfilePictureUrls = seenReceipts
                    .Select(receipt => receipt.User?.ProfilePictureUrl ?? "default-profile.png")
                    .ToList(),
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

        private static List<MessageReactionDto> ToMessageReactionDtos(IEnumerable<GroupMessageReaction> reactions)
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

        private async Task BroadcastStatusUpdatesAsync(
            int? groupId,
            int? conversationId,
            string chatType,
            IReadOnlyList<MessageStatusChange> changes)
        {
            foreach (var change in changes)
            {
                await BroadcastStatusUpdateAsync(groupId, conversationId, chatType, change);
            }
        }

        private async Task BroadcastStatusUpdateAsync(
            int? groupId,
            int? conversationId,
            string chatType,
            MessageStatusChange? change)
        {
            if (change == null)
                return;

            var updatedMessage = groupId.HasValue
                ? await _groupChatRepository.GetMessageByIdAsync(groupId.Value, change.MessageId)
                : null;
            var seenReceipts = updatedMessage != null
                ? GetSeenReceipts(updatedMessage)
                : Array.Empty<GroupMessageReceipt>();

            await _hubContext.Clients
                .Group(ChatHub.GetGroupChannelName(groupId?.ToString() ?? string.Empty))
                .SendAsync("ReceiveMessageStatusUpdate", new ChatMessageStatusUpdateDto
                {
                    MessageId = change.MessageId,
                    ChatType = chatType,
                    GroupId = groupId,
                    ConversationId = conversationId,
                    UserId = change.UserId,
                    DeliveredAt = change.DeliveredAt.HasValue ? BosniaTimeHelper.ToSarajevoOffset(change.DeliveredAt.Value) : null,
                    SeenAt = change.SeenAt.HasValue ? BosniaTimeHelper.ToSarajevoOffset(change.SeenAt.Value) : null,
                    SeenByUserIds = seenReceipts
                        .Select(receipt => receipt.UserId)
                        .ToList(),
                    SeenByUserNames = seenReceipts
                        .Select(receipt => !string.IsNullOrWhiteSpace(receipt.User?.FullName)
                            ? receipt.User.FullName
                            : receipt.User?.UserName ?? string.Empty)
                        .Where(name => !string.IsNullOrWhiteSpace(name))
                        .ToList(),
                    SeenByUserProfilePictureUrls = seenReceipts
                        .Select(receipt => receipt.User?.ProfilePictureUrl ?? "default-profile.png")
                        .ToList()
                });
        }

        private static IReadOnlyList<GroupMessageReceipt> GetSeenReceipts(GroupMessage message)
        {
            return message.Receipts
                .Where(receipt =>
                    receipt.UserId != message.SenderUserId
                    && receipt.SeenAt.HasValue)
                .OrderBy(receipt => receipt.SeenAt)
                .ToList();
        }
    }
}
