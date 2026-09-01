using Microsoft.EntityFrameworkCore;
using SportsBookingAPI.Data;
using SportsBookingAPI.DTOs;
using SportsBookingAPI.Helpers;
using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Repositories
{
    public class GroupChatRepository : IGroupChatRepository
    {
        private static readonly TimeSpan ReactionNotificationCooldown = TimeSpan.FromSeconds(30);

        private readonly ApplicationDBContext _context;

        public GroupChatRepository(ApplicationDBContext context)
        {
            _context = context;
        }

        public async Task<IReadOnlyList<GroupMessage>> GetMessagesForGroupAsync(int groupId)
        {
            return await _context.GroupMessages
                .Where(message => message.GroupId == groupId && !message.IsDeleted)
                .Include(message => message.SenderUser)
                .Include(message => message.Receipts)
                    .ThenInclude(receipt => receipt.User)
                .Include(message => message.Reactions)
                    .ThenInclude(reaction => reaction.User)
                .Include(message => message.ReplyToMessage)
                    .ThenInclude(replyToMessage => replyToMessage!.SenderUser)
                .OrderBy(message => message.CreatedAt)
                .ToListAsync();
        }

        public async Task<GroupMessage?> GetMessageByIdAsync(int groupId, int messageId)
        {
            return await _context.GroupMessages
                .Where(message => message.GroupId == groupId && message.Id == messageId && !message.IsDeleted)
                .Include(message => message.SenderUser)
                .Include(message => message.Receipts)
                    .ThenInclude(receipt => receipt.User)
                .Include(message => message.Reactions)
                    .ThenInclude(reaction => reaction.User)
                .Include(message => message.ReplyToMessage)
                    .ThenInclude(replyToMessage => replyToMessage!.SenderUser)
                .FirstOrDefaultAsync();
        }

        public async Task<GroupMessage> CreateMessageAsync(GroupMessage message)
        {
            _context.GroupMessages.Add(message);
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

        public async Task CreateMessageReceiptsAsync(IEnumerable<GroupMessageReceipt> receipts)
        {
            var receiptList = receipts.ToList();
            if (receiptList.Count == 0)
                return;

            _context.GroupMessageReceipts.AddRange(receiptList);
            await _context.SaveChangesAsync();
        }

        public async Task<IReadOnlyList<GroupChatNotificationDto>> GetChatNotificationsAsync(string userId, int take)
        {
            var accessibleGroupIds = await _context.Groups
                .Where(group =>
                    group.AdminId == userId
                    || group.Memberships.Any(membership =>
                        membership.UserId == userId
                        && membership.Status == MembershipStatus.Accepted))
                .Select(group => group.Id)
                .ToListAsync();

            if (accessibleGroupIds.Count == 0)
                return Array.Empty<GroupChatNotificationDto>();

            var allMessages = await _context.GroupMessages
                .Where(message => accessibleGroupIds.Contains(message.GroupId))
                .Include(message => message.Group)
                .Include(message => message.SenderUser)
                .ToListAsync();

            if (allMessages.Count == 0)
                return Array.Empty<GroupChatNotificationDto>();

            var latestMessages = allMessages
                .Where(message => !message.IsDeleted)
                .GroupBy(message => message.GroupId)
                .Select(group => group
                    .OrderByDescending(message => message.CreatedAt)
                    .First())
                .OrderByDescending(message => message.CreatedAt)
                .Take(take)
                .ToList();

            if (latestMessages.Count == 0)
                return Array.Empty<GroupChatNotificationDto>();

            var groupIds = latestMessages.Select(message => message.GroupId).Distinct().ToList();

            var readStates = await _context.GroupChatReadStates
                .Where(readState => readState.UserId == userId && groupIds.Contains(readState.GroupId))
                .ToDictionaryAsync(readState => readState.GroupId, readState => readState.LastReadAt);

            var membershipJoinDates = await GetMembershipJoinDatesAsync(userId, groupIds);

            var unreadCounts = allMessages
                .Where(message => groupIds.Contains(message.GroupId) && message.SenderUserId != userId && !message.IsDeleted)
                .GroupBy(message => message.GroupId)
                .ToDictionary(
                    group => group.Key,
                    group => group.Count(message => IsMessageUnread(message, group.Key, readStates, membershipJoinDates)));

            return latestMessages.Select(message =>
            {
                var unreadCount = unreadCounts.GetValueOrDefault(message.GroupId);
                var senderName = !string.IsNullOrWhiteSpace(message.SenderUser?.FullName)
                    ? message.SenderUser.FullName
                    : message.SenderUser?.UserName ?? string.Empty;

                return new GroupChatNotificationDto
                {
                    GroupId = message.GroupId,
                    GroupName = message.Group?.Name ?? string.Empty,
                    GroupImageUrl = message.Group?.ImageUrl ?? "default-group.png",
                    SenderUserId = message.SenderUserId,
                    SenderName = senderName,
                    SenderProfilePictureUrl = message.SenderUser?.ProfilePictureUrl ?? "default-profile.png",
                    LatestMessagePreview = message.MessageText,
                    CreatedAt = BosniaTimeHelper.ToSarajevoOffset(message.CreatedAt),
                    UnreadCount = unreadCount,
                    IsRead = unreadCount == 0
                };
            }).ToList();
        }

        public async Task<int> GetUnreadChatMessagesCountAsync(string userId)
        {
            var accessibleGroupIds = await _context.Groups
                .Where(group =>
                    group.AdminId == userId
                    || group.Memberships.Any(membership =>
                        membership.UserId == userId
                        && membership.Status == MembershipStatus.Accepted))
                .Select(group => group.Id)
                .ToListAsync();

            if (accessibleGroupIds.Count == 0)
                return 0;

            var readStates = await _context.GroupChatReadStates
                .Where(readState => readState.UserId == userId)
                .ToDictionaryAsync(readState => readState.GroupId, readState => readState.LastReadAt);

            var membershipJoinDates = await GetMembershipJoinDatesAsync(userId, accessibleGroupIds);

            var unreadMessages = await _context.GroupMessages
                .Where(message =>
                    accessibleGroupIds.Contains(message.GroupId)
                    && message.SenderUserId != userId
                    && !message.IsDeleted)
                .ToListAsync();

            return unreadMessages.Count(message => IsMessageUnread(message, message.GroupId, readStates, membershipJoinDates));
        }

        private async Task<Dictionary<int, DateTime>> GetMembershipJoinDatesAsync(string userId, IReadOnlyList<int> groupIds)
        {
            return await _context.GroupMemberships
                .Where(membership =>
                    membership.UserId == userId
                    && membership.Status == MembershipStatus.Accepted
                    && groupIds.Contains(membership.GroupId))
                .ToDictionaryAsync(membership => membership.GroupId, membership => membership.JoinedAt);
        }

        private static bool IsMessageUnread(
            GroupMessage message,
            int groupId,
            IReadOnlyDictionary<int, DateTime> readStates,
            IReadOnlyDictionary<int, DateTime> membershipJoinDates)
        {
            var isAfterLastRead = !readStates.TryGetValue(groupId, out var lastReadAt) || message.CreatedAt > lastReadAt;
            var isAfterJoin = !membershipJoinDates.TryGetValue(groupId, out var joinedAt) || message.CreatedAt >= joinedAt;

            return isAfterLastRead && isAfterJoin;
        }

        public async Task MarkGroupAsReadAsync(string userId, int groupId, DateTime readAt)
        {
            var readState = await _context.GroupChatReadStates
                .FirstOrDefaultAsync(existingState =>
                    existingState.UserId == userId
                    && existingState.GroupId == groupId);

            if (readState == null)
            {
                _context.GroupChatReadStates.Add(new GroupChatReadState
                {
                    UserId = userId,
                    GroupId = groupId,
                    LastReadAt = readAt
                });
            }
            else
            {
                readState.LastReadAt = readAt;
            }

            await _context.SaveChangesAsync();
        }

        public async Task<bool> IsGroupChatParticipantAsync(int groupId, string userId)
        {
            return await _context.Groups.AnyAsync(group =>
                group.Id == groupId
                && (group.AdminId == userId
                    || group.Memberships.Any(membership =>
                        membership.UserId == userId
                        && membership.Status == MembershipStatus.Accepted)));
        }

        public async Task<MessageStatusChange?> MarkMessageDeliveredAsync(int groupId, int messageId, string userId, DateTime deliveredAt)
        {
            var receipt = await _context.GroupMessageReceipts
                .Include(existingReceipt => existingReceipt.GroupMessage)
                .FirstOrDefaultAsync(existingReceipt =>
                    existingReceipt.GroupMessageId == messageId
                    && existingReceipt.UserId == userId
                    && existingReceipt.GroupMessage.GroupId == groupId);

            if (receipt == null)
                return null;

            if (receipt.DeliveredAt.HasValue)
            {
                if (receipt.SeenAt.HasValue)
                {
                    return null;
                }

                return new MessageStatusChange
                {
                    MessageId = messageId,
                    UserId = userId,
                    DeliveredAt = receipt.DeliveredAt,
                    SeenAt = receipt.SeenAt
                };
            }

            receipt.DeliveredAt = deliveredAt;
            await _context.SaveChangesAsync();

            return new MessageStatusChange
            {
                MessageId = messageId,
                UserId = userId,
                DeliveredAt = receipt.DeliveredAt,
                SeenAt = receipt.SeenAt
            };
        }

        public async Task<IReadOnlyList<MessageStatusChange>> MarkMessageSeenAsync(int groupId, int messageId, string userId, DateTime seenAt)
        {
            var receipts = await _context.GroupMessageReceipts
                .Include(existingReceipt => existingReceipt.GroupMessage)
                .Where(existingReceipt =>
                    existingReceipt.UserId == userId
                    && existingReceipt.GroupMessage.GroupId == groupId)
                .OrderBy(existingReceipt => existingReceipt.GroupMessage.CreatedAt)
                .ThenBy(existingReceipt => existingReceipt.GroupMessageId)
                .ToListAsync();

            var targetReceipt = receipts.FirstOrDefault(existingReceipt =>
                    existingReceipt.GroupMessageId == messageId
                    && existingReceipt.UserId == userId
                    && existingReceipt.GroupMessage.GroupId == groupId);

            if (targetReceipt == null)
                return Array.Empty<MessageStatusChange>();

            var changes = new List<MessageStatusChange>();

            foreach (var receipt in receipts)
            {
                var didChange = false;

                if (receipt.Id == targetReceipt.Id)
                {
                    if (!receipt.DeliveredAt.HasValue)
                    {
                        receipt.DeliveredAt = seenAt;
                        didChange = true;
                    }

                    if (receipt.SeenAt != seenAt)
                    {
                        receipt.SeenAt = seenAt;
                        didChange = true;
                    }
                }
                else if (receipt.SeenAt.HasValue)
                {
                    receipt.SeenAt = null;
                    didChange = true;
                }

                if (!didChange)
                {
                    continue;
                }

                changes.Add(new MessageStatusChange
                {
                    MessageId = receipt.GroupMessageId,
                    UserId = userId,
                    DeliveredAt = receipt.DeliveredAt,
                    SeenAt = receipt.SeenAt
                });
            }

            if (changes.Count == 0)
            {
                return Array.Empty<MessageStatusChange>();
            }

            await _context.SaveChangesAsync();

            return changes;
        }

        public async Task<IReadOnlyList<MessageStatusChange>> MarkMessagesSeenForGroupAsync(int groupId, string userId, DateTime seenAt)
        {
            var receipts = await _context.GroupMessageReceipts
                .Include(receipt => receipt.GroupMessage)
                .Where(receipt =>
                    receipt.UserId == userId
                    && receipt.GroupMessage.GroupId == groupId)
                .OrderBy(receipt => receipt.GroupMessage.CreatedAt)
                .ThenBy(receipt => receipt.GroupMessageId)
                .ToListAsync();

            if (receipts.Count == 0)
                return Array.Empty<MessageStatusChange>();

            var latestReceiptId = receipts
                .OrderByDescending(receipt => receipt.GroupMessage.CreatedAt)
                .ThenByDescending(receipt => receipt.GroupMessageId)
                .Select(receipt => (int?)receipt.Id)
                .FirstOrDefault();

            var changes = new List<MessageStatusChange>();

            foreach (var receipt in receipts)
            {
                var didChange = false;

                if (!receipt.DeliveredAt.HasValue)
                {
                    receipt.DeliveredAt = seenAt;
                    didChange = true;
                }

                if (latestReceiptId.HasValue
                    && receipt.Id == latestReceiptId.Value)
                {
                    if (receipt.SeenAt != seenAt)
                    {
                        receipt.SeenAt = seenAt;
                        didChange = true;
                    }
                }
                else if (receipt.SeenAt.HasValue)
                {
                    receipt.SeenAt = null;
                    didChange = true;
                }

                if (!didChange)
                {
                    continue;
                }

                changes.Add(new MessageStatusChange
                {
                    MessageId = receipt.GroupMessageId,
                    UserId = userId,
                    DeliveredAt = receipt.DeliveredAt,
                    SeenAt = receipt.SeenAt
                });
            }

            await _context.SaveChangesAsync();

            return changes;
        }

        public async Task SoftDeleteMessageAsync(GroupMessage message)
        {
            message.IsDeleted = true;
            message.DeletedAt = DateTime.UtcNow;
            message.MessageText = string.Empty;
            await _context.SaveChangesAsync();
        }

        public async Task<bool> HasAnyMessagesAsync(int groupId)
        {
            return await _context.GroupMessages
                .AnyAsync(message => message.GroupId == groupId && !message.IsDeleted);
        }

        public async Task<GroupMessage?> GetLatestNonDeletedMessageAsync(int groupId)
        {
            return await _context.GroupMessages
                .Where(message => message.GroupId == groupId && !message.IsDeleted)
                .Include(message => message.SenderUser)
                .OrderByDescending(message => message.CreatedAt)
                .FirstOrDefaultAsync();
        }

        public async Task SetMessagePinnedAsync(GroupMessage message, bool isPinned, DateTime? pinnedAt)
        {
            message.IsPinned = isPinned;
            message.PinnedAt = pinnedAt;
            await _context.SaveChangesAsync();
        }

        public async Task<IReadOnlyList<GroupMessageReaction>> AddOrUpdateReactionAsync(int messageId, string userId, string emoji)
        {
            var existingReaction = await _context.GroupMessageReactions
                .FirstOrDefaultAsync(reaction => reaction.GroupMessageId == messageId && reaction.UserId == userId);

            if (existingReaction == null)
            {
                _context.GroupMessageReactions.Add(new GroupMessageReaction
                {
                    GroupMessageId = messageId,
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
            var existing = await _context.GroupMessageReactionNotifications
                .FirstOrDefaultAsync(record => record.GroupMessageId == messageId && record.ReactorUserId == reactorUserId);

            if (existing == null)
            {
                _context.GroupMessageReactionNotifications.Add(new GroupMessageReactionNotification
                {
                    GroupMessageId = messageId,
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

        public async Task<IReadOnlyList<GroupMessageReaction>> RemoveReactionAsync(int messageId, string userId)
        {
            var existingReaction = await _context.GroupMessageReactions
                .FirstOrDefaultAsync(reaction => reaction.GroupMessageId == messageId && reaction.UserId == userId);

            if (existingReaction != null)
            {
                _context.GroupMessageReactions.Remove(existingReaction);
                await _context.SaveChangesAsync();
            }

            return await GetReactionsForMessageAsync(messageId);
        }

        private async Task<IReadOnlyList<GroupMessageReaction>> GetReactionsForMessageAsync(int messageId)
        {
            return await _context.GroupMessageReactions
                .Where(reaction => reaction.GroupMessageId == messageId)
                .Include(reaction => reaction.User)
                .OrderBy(reaction => reaction.CreatedAt)
                .ToListAsync();
        }
    }
}
