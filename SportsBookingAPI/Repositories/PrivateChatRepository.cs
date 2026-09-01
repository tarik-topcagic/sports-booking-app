using Microsoft.EntityFrameworkCore;
using SportsBookingAPI.Data;
using SportsBookingAPI.DTOs;
using SportsBookingAPI.Helpers;
using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Repositories
{
    public class PrivateChatRepository : IPrivateChatRepository
    {
        private static readonly TimeSpan ReactionNotificationCooldown = TimeSpan.FromSeconds(30);

        private readonly ApplicationDBContext _context;

        public PrivateChatRepository(ApplicationDBContext context)
        {
            _context = context;
        }

        public async Task<AppUser?> GetUserByIdAsync(string userId)
        {
            return await _context.Users.FirstOrDefaultAsync(user => user.Id == userId);
        }

        public async Task<PrivateConversation?> GetConversationByIdAsync(int conversationId)
        {
            return await _context.PrivateConversations
                .Include(conversation => conversation.UserOne)
                .Include(conversation => conversation.UserTwo)
                .Include(conversation => conversation.PrivateMessages)
                .FirstOrDefaultAsync(conversation => conversation.Id == conversationId);
        }

        public async Task<PrivateConversation?> GetConversationBetweenUsersAsync(string userOneId, string userTwoId)
        {
            return await _context.PrivateConversations
                .Include(conversation => conversation.UserOne)
                .Include(conversation => conversation.UserTwo)
                .Include(conversation => conversation.PrivateMessages)
                .FirstOrDefaultAsync(conversation =>
                    conversation.UserOneId == userOneId
                    && conversation.UserTwoId == userTwoId);
        }

        public async Task<PrivateConversation> CreateConversationAsync(PrivateConversation conversation)
        {
            _context.PrivateConversations.Add(conversation);
            await _context.SaveChangesAsync();

            await _context.Entry(conversation)
                .Reference(savedConversation => savedConversation.UserOne)
                .LoadAsync();

            await _context.Entry(conversation)
                .Reference(savedConversation => savedConversation.UserTwo)
                .LoadAsync();

            return conversation;
        }

        public async Task<bool> HasConversationAsync(string userOneId, string userTwoId)
        {
            return await _context.PrivateConversations.AnyAsync(conversation =>
                (conversation.UserOneId == userOneId && conversation.UserTwoId == userTwoId)
                || (conversation.UserOneId == userTwoId && conversation.UserTwoId == userOneId));
        }

        public async Task<IReadOnlyList<string>> GetConversationPartnerUserIdsAsync(string userId)
        {
            return await _context.PrivateConversations
                .Where(conversation => conversation.UserOneId == userId || conversation.UserTwoId == userId)
                .Select(conversation => conversation.UserOneId == userId
                    ? conversation.UserTwoId
                    : conversation.UserOneId)
                .Distinct()
                .ToListAsync();
        }

        public async Task<IReadOnlyList<PrivateConversation>> GetConversationsForUserAsync(string userId)
        {
            var conversations = await _context.PrivateConversations
                .Where(conversation => conversation.UserOneId == userId || conversation.UserTwoId == userId)
                .Include(conversation => conversation.UserOne)
                .Include(conversation => conversation.UserTwo)
                .Include(conversation => conversation.PrivateMessages)
                    .ThenInclude(message => message.SenderUser)
                .ToListAsync();

            return conversations
                .OrderByDescending(conversation => conversation.PrivateMessages
                    .OrderByDescending(message => message.CreatedAt)
                    .Select(message => (DateTime?)message.CreatedAt)
                    .FirstOrDefault() ?? conversation.CreatedAt)
                .ToList();
        }

        public async Task<IReadOnlyList<PrivateMessage>> GetMessagesForConversationAsync(int conversationId)
        {
            return await _context.PrivateMessages
                .Where(message => message.ConversationId == conversationId && !message.IsDeleted)
                .Include(message => message.SenderUser)
                .Include(message => message.Reactions)
                    .ThenInclude(reaction => reaction.User)
                .Include(message => message.ReplyToMessage)
                    .ThenInclude(replyToMessage => replyToMessage!.SenderUser)
                .OrderBy(message => message.CreatedAt)
                .ToListAsync();
        }

        public async Task<PrivateMessage?> GetMessageByIdAsync(int conversationId, int messageId)
        {
            return await _context.PrivateMessages
                .Where(message => message.ConversationId == conversationId && message.Id == messageId && !message.IsDeleted)
                .Include(message => message.SenderUser)
                .Include(message => message.Reactions)
                    .ThenInclude(reaction => reaction.User)
                .Include(message => message.ReplyToMessage)
                    .ThenInclude(replyToMessage => replyToMessage!.SenderUser)
                .FirstOrDefaultAsync();
        }

        public async Task<PrivateMessage> CreateMessageAsync(PrivateMessage message)
        {
            _context.PrivateMessages.Add(message);
            await _context.SaveChangesAsync();

            await _context.Entry(message)
                .Reference(savedMessage => savedMessage.SenderUser)
                .LoadAsync();

            if (message.ReplyToMessageId.HasValue)
            {
                await _context.Entry(message)
                    .Reference(savedMessage => savedMessage.ReplyToMessage)
                    .LoadAsync();

                if (message.ReplyToMessage != null)
                {
                    await _context.Entry(message.ReplyToMessage)
                        .Reference(replyToMessage => replyToMessage.SenderUser)
                        .LoadAsync();
                }
            }

            return message;
        }

        public async Task<IReadOnlyList<PrivateChatNotificationDto>> GetChatNotificationsAsync(string userId, int take)
        {
            var conversations = await _context.PrivateConversations
                .Where(conversation => conversation.UserOneId == userId || conversation.UserTwoId == userId)
                .Include(conversation => conversation.UserOne)
                .Include(conversation => conversation.UserTwo)
                .Include(conversation => conversation.PrivateMessages)
                    .ThenInclude(message => message.SenderUser)
                .ToListAsync();

            if (conversations.Count == 0)
                return Array.Empty<PrivateChatNotificationDto>();

            var conversationIds = conversations.Select(conversation => conversation.Id).ToList();

            var readStates = await _context.PrivateChatReadStates
                .Where(readState => readState.UserId == userId && conversationIds.Contains(readState.ConversationId))
                .ToDictionaryAsync(readState => readState.ConversationId, readState => readState.LastReadAt);

            var latestMessages = conversations
                .Select(conversation => new
                {
                    Conversation = conversation,
                    LatestMessage = conversation.PrivateMessages
                        .Where(message => !message.IsDeleted)
                        .OrderByDescending(message => message.CreatedAt)
                        .FirstOrDefault()
                })
                .Where(item => item.LatestMessage != null)
                .OrderByDescending(item => item.LatestMessage!.CreatedAt)
                .Take(take)
                .ToList();

            return latestMessages.Select(item =>
            {
                var conversation = item.Conversation;
                var latestMessage = item.LatestMessage!;
                var otherUser = conversation.UserOneId == userId ? conversation.UserTwo : conversation.UserOne;
                var unreadCount = conversation.PrivateMessages.Count(message =>
                    message.SenderUserId != userId
                    && !message.IsDeleted
                    && (!readStates.TryGetValue(conversation.Id, out var lastReadAt) || message.CreatedAt > lastReadAt));

                return new PrivateChatNotificationDto
                {
                    ConversationId = conversation.Id,
                    OtherUserId = otherUser?.Id ?? string.Empty,
                    OtherUsername = otherUser?.UserName ?? string.Empty,
                    OtherFullName = !string.IsNullOrWhiteSpace(otherUser?.FullName)
                        ? otherUser.FullName
                        : otherUser?.UserName ?? string.Empty,
                    OtherProfilePictureUrl = otherUser?.ProfilePictureUrl ?? "default-profile.png",
                    LatestMessagePreview = latestMessage.MessageText,
                    CreatedAt = BosniaTimeHelper.ToSarajevoOffset(latestMessage.CreatedAt),
                    UnreadCount = unreadCount,
                    IsRead = unreadCount == 0
                };
            }).ToList();
        }

        public async Task<int> GetUnreadChatMessagesCountAsync(string userId)
        {
            var conversations = await _context.PrivateConversations
                .Where(conversation => conversation.UserOneId == userId || conversation.UserTwoId == userId)
                .Include(conversation => conversation.PrivateMessages)
                .ToListAsync();

            if (conversations.Count == 0)
                return 0;

            var conversationIds = conversations.Select(conversation => conversation.Id).ToList();
            var readStates = await _context.PrivateChatReadStates
                .Where(readState => readState.UserId == userId && conversationIds.Contains(readState.ConversationId))
                .ToDictionaryAsync(readState => readState.ConversationId, readState => readState.LastReadAt);

            return conversations.Sum(conversation => conversation.PrivateMessages.Count(message =>
                message.SenderUserId != userId
                && !message.IsDeleted
                && (!readStates.TryGetValue(conversation.Id, out var lastReadAt) || message.CreatedAt > lastReadAt)));
        }

        public async Task MarkConversationAsReadAsync(string userId, int conversationId, DateTime readAt)
        {
            var readState = await _context.PrivateChatReadStates
                .FirstOrDefaultAsync(existingState =>
                    existingState.UserId == userId
                    && existingState.ConversationId == conversationId);

            if (readState == null)
            {
                _context.PrivateChatReadStates.Add(new PrivateChatReadState
                {
                    UserId = userId,
                    ConversationId = conversationId,
                    LastReadAt = readAt
                });
            }
            else
            {
                readState.LastReadAt = readAt;
            }

            await _context.SaveChangesAsync();
        }

        public async Task<MessageStatusChange?> MarkMessageDeliveredAsync(int conversationId, int messageId, string userId, DateTime deliveredAt)
        {
            var message = await _context.PrivateMessages
                .Include(existingMessage => existingMessage.Conversation)
                .FirstOrDefaultAsync(existingMessage =>
                    existingMessage.Id == messageId
                    && existingMessage.ConversationId == conversationId
                    && existingMessage.SenderUserId != userId
                    && (existingMessage.Conversation.UserOneId == userId || existingMessage.Conversation.UserTwoId == userId));

            if (message == null)
                return null;

            if (message.DeliveredAt.HasValue)
            {
                if (message.SeenAt.HasValue)
                {
                    return null;
                }

                return new MessageStatusChange
                {
                    MessageId = message.Id,
                    UserId = userId,
                    DeliveredAt = message.DeliveredAt,
                    SeenAt = message.SeenAt
                };
            }

            message.DeliveredAt = deliveredAt;
            await _context.SaveChangesAsync();

            return new MessageStatusChange
            {
                MessageId = message.Id,
                UserId = userId,
                DeliveredAt = message.DeliveredAt,
                SeenAt = message.SeenAt
            };
        }

        public async Task<IReadOnlyList<MessageStatusChange>> MarkMessageSeenAsync(int conversationId, int messageId, string userId, DateTime seenAt)
        {
            var messages = await _context.PrivateMessages
                .Include(existingMessage => existingMessage.Conversation)
                .Where(existingMessage =>
                    existingMessage.ConversationId == conversationId
                    && existingMessage.SenderUserId != userId
                    && (existingMessage.Conversation.UserOneId == userId || existingMessage.Conversation.UserTwoId == userId))
                .OrderBy(existingMessage => existingMessage.CreatedAt)
                .ToListAsync();

            var targetMessage = messages.FirstOrDefault(existingMessage =>
                    existingMessage.Id == messageId
                    && existingMessage.ConversationId == conversationId
                    && existingMessage.SenderUserId != userId);

            if (targetMessage == null)
                return Array.Empty<MessageStatusChange>();

            var changes = new List<MessageStatusChange>();

            foreach (var message in messages)
            {
                var didChange = false;

                if (message.Id == targetMessage.Id)
                {
                    if (!message.DeliveredAt.HasValue)
                    {
                        message.DeliveredAt = seenAt;
                        didChange = true;
                    }

                    if (message.SeenAt != seenAt)
                    {
                        message.SeenAt = seenAt;
                        didChange = true;
                    }
                }
                else if (message.SeenAt.HasValue)
                {
                    message.SeenAt = null;
                    didChange = true;
                }

                if (!didChange)
                {
                    continue;
                }

                changes.Add(new MessageStatusChange
                {
                    MessageId = message.Id,
                    UserId = userId,
                    DeliveredAt = message.DeliveredAt,
                    SeenAt = message.SeenAt
                });
            }

            if (changes.Count == 0)
                return Array.Empty<MessageStatusChange>();

            await _context.SaveChangesAsync();

            return changes;
        }

        public async Task<IReadOnlyList<MessageStatusChange>> MarkMessagesSeenForConversationAsync(int conversationId, string userId, DateTime seenAt)
        {
            var messages = await _context.PrivateMessages
                .Include(existingMessage => existingMessage.Conversation)
                .Where(existingMessage =>
                    existingMessage.ConversationId == conversationId
                    && existingMessage.SenderUserId != userId
                    && (existingMessage.Conversation.UserOneId == userId || existingMessage.Conversation.UserTwoId == userId))
                .OrderBy(existingMessage => existingMessage.CreatedAt)
                .ToListAsync();

            if (messages.Count == 0)
                return Array.Empty<MessageStatusChange>();

            var latestIncomingMessageId = messages
                .OrderByDescending(message => message.CreatedAt)
                .Select(message => (int?)message.Id)
                .FirstOrDefault();

            var changes = new List<MessageStatusChange>();

            foreach (var message in messages)
            {
                var didChange = false;

                if (!message.DeliveredAt.HasValue)
                {
                    message.DeliveredAt = seenAt;
                    didChange = true;
                }

                if (latestIncomingMessageId.HasValue
                    && message.Id == latestIncomingMessageId.Value)
                {
                    if (message.SeenAt != seenAt)
                    {
                        message.SeenAt = seenAt;
                        didChange = true;
                    }
                }
                else if (message.SeenAt.HasValue)
                {
                    message.SeenAt = null;
                    didChange = true;
                }

                if (!didChange)
                {
                    continue;
                }

                changes.Add(new MessageStatusChange
                {
                    MessageId = message.Id,
                    UserId = userId,
                    DeliveredAt = message.DeliveredAt,
                    SeenAt = message.SeenAt
                });
            }

            await _context.SaveChangesAsync();

            return changes;
        }

        public async Task SoftDeleteMessageAsync(PrivateMessage message)
        {
            message.IsDeleted = true;
            message.DeletedAt = DateTime.UtcNow;
            message.MessageText = string.Empty;
            await _context.SaveChangesAsync();
        }

        public async Task<bool> HasAnyMessagesAsync(int conversationId)
        {
            return await _context.PrivateMessages
                .AnyAsync(message => message.ConversationId == conversationId && !message.IsDeleted);
        }

        public async Task<PrivateMessage?> GetLatestNonDeletedMessageAsync(int conversationId)
        {
            return await _context.PrivateMessages
                .Where(message => message.ConversationId == conversationId && !message.IsDeleted)
                .Include(message => message.SenderUser)
                .OrderByDescending(message => message.CreatedAt)
                .FirstOrDefaultAsync();
        }

        public async Task SetMessagePinnedAsync(PrivateMessage message, bool isPinned, DateTime? pinnedAt)
        {
            message.IsPinned = isPinned;
            message.PinnedAt = pinnedAt;
            await _context.SaveChangesAsync();
        }

        public async Task<IReadOnlyList<PrivateMessageReaction>> AddOrUpdateReactionAsync(int messageId, string userId, string emoji)
        {
            var existingReaction = await _context.PrivateMessageReactions
                .FirstOrDefaultAsync(reaction => reaction.PrivateMessageId == messageId && reaction.UserId == userId);

            if (existingReaction == null)
            {
                _context.PrivateMessageReactions.Add(new PrivateMessageReaction
                {
                    PrivateMessageId = messageId,
                    UserId = userId,
                    Emoji = emoji,
                    CreatedAt = DateTime.UtcNow
                });
            }
            else
            {
                existingReaction.Emoji = emoji;
                existingReaction.CreatedAt = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();

            return await GetReactionsForMessageAsync(messageId);
        }

        public async Task<bool> ShouldTreatReactionAsNewNotificationAsync(int messageId, string reactorUserId)
        {
            var existing = await _context.PrivateMessageReactionNotifications
                .FirstOrDefaultAsync(record => record.PrivateMessageId == messageId && record.ReactorUserId == reactorUserId);

            if (existing == null)
            {
                _context.PrivateMessageReactionNotifications.Add(new PrivateMessageReactionNotification
                {
                    PrivateMessageId = messageId,
                    ReactorUserId = reactorUserId,
                    CreatedAt = DateTime.UtcNow
                });

                try
                {
                    await _context.SaveChangesAsync();
                    return true;
                }
                catch (DbUpdateException)
                {
                    return false;
                }
            }

            if (DateTime.UtcNow - existing.CreatedAt <= ReactionNotificationCooldown)
                return false;

            existing.CreatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return true;
        }

        public async Task<IReadOnlyList<PrivateMessageReaction>> RemoveReactionAsync(int messageId, string userId)
        {
            var existingReaction = await _context.PrivateMessageReactions
                .FirstOrDefaultAsync(reaction => reaction.PrivateMessageId == messageId && reaction.UserId == userId);

            if (existingReaction != null)
            {
                _context.PrivateMessageReactions.Remove(existingReaction);
                await _context.SaveChangesAsync();
            }

            return await GetReactionsForMessageAsync(messageId);
        }

        private async Task<IReadOnlyList<PrivateMessageReaction>> GetReactionsForMessageAsync(int messageId)
        {
            return await _context.PrivateMessageReactions
                .Where(reaction => reaction.PrivateMessageId == messageId)
                .Include(reaction => reaction.User)
                .OrderBy(reaction => reaction.CreatedAt)
                .ToListAsync();
        }
    }
}
