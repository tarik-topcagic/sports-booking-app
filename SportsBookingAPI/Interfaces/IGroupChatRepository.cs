using SportsBookingAPI.DTOs;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Interfaces
{
    public interface IGroupChatRepository
    {
        Task<IReadOnlyList<GroupMessage>> GetMessagesForGroupAsync(int groupId);
        Task<GroupMessage?> GetMessageByIdAsync(int groupId, int messageId);
        Task<GroupMessage> CreateMessageAsync(GroupMessage message);
        Task CreateMessageReceiptsAsync(IEnumerable<GroupMessageReceipt> receipts);
        Task<IReadOnlyList<GroupChatNotificationDto>> GetChatNotificationsAsync(string userId, int take);
        Task<int> GetUnreadChatMessagesCountAsync(string userId);
        Task MarkGroupAsReadAsync(string userId, int groupId, DateTime readAt);
        Task<bool> IsGroupChatParticipantAsync(int groupId, string userId);
        Task<MessageStatusChange?> MarkMessageDeliveredAsync(int groupId, int messageId, string userId, DateTime deliveredAt);
        Task<IReadOnlyList<MessageStatusChange>> MarkMessageSeenAsync(int groupId, int messageId, string userId, DateTime seenAt);
        Task<IReadOnlyList<MessageStatusChange>> MarkMessagesSeenForGroupAsync(int groupId, string userId, DateTime seenAt);
        Task SoftDeleteMessageAsync(GroupMessage message);
        Task<bool> HasAnyMessagesAsync(int groupId);
        Task<GroupMessage?> GetLatestNonDeletedMessageAsync(int groupId);
        Task SetMessagePinnedAsync(GroupMessage message, bool isPinned, DateTime? pinnedAt);
        Task<IReadOnlyList<GroupMessageReaction>> AddOrUpdateReactionAsync(int messageId, string userId, string emoji);
        Task<IReadOnlyList<GroupMessageReaction>> RemoveReactionAsync(int messageId, string userId);
        Task<bool> ShouldTreatReactionAsNewNotificationAsync(int messageId, string reactorUserId);
    }
}
