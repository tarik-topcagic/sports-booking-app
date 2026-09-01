using SportsBookingAPI.Models;
using SportsBookingAPI.DTOs;

namespace SportsBookingAPI.Interfaces
{
    public interface IPrivateChatRepository
    {
        Task<AppUser?> GetUserByIdAsync(string userId);
        Task<PrivateConversation?> GetConversationByIdAsync(int conversationId);
        Task<PrivateConversation?> GetConversationBetweenUsersAsync(string userOneId, string userTwoId);
        Task<PrivateConversation> CreateConversationAsync(PrivateConversation conversation);
        Task<bool> HasConversationAsync(string userOneId, string userTwoId);
        Task<IReadOnlyList<string>> GetConversationPartnerUserIdsAsync(string userId);
        Task<IReadOnlyList<PrivateConversation>> GetConversationsForUserAsync(string userId);
        Task<IReadOnlyList<PrivateMessage>> GetMessagesForConversationAsync(int conversationId);
        Task<PrivateMessage> CreateMessageAsync(PrivateMessage message);
        Task<IReadOnlyList<PrivateChatNotificationDto>> GetChatNotificationsAsync(string userId, int take);
        Task<int> GetUnreadChatMessagesCountAsync(string userId);
        Task MarkConversationAsReadAsync(string userId, int conversationId, DateTime readAt);
        Task<MessageStatusChange?> MarkMessageDeliveredAsync(int conversationId, int messageId, string userId, DateTime deliveredAt);
        Task<IReadOnlyList<MessageStatusChange>> MarkMessageSeenAsync(int conversationId, int messageId, string userId, DateTime seenAt);
        Task<IReadOnlyList<MessageStatusChange>> MarkMessagesSeenForConversationAsync(int conversationId, string userId, DateTime seenAt);
        Task<PrivateMessage?> GetMessageByIdAsync(int conversationId, int messageId);
        Task SoftDeleteMessageAsync(PrivateMessage message);
        Task<bool> HasAnyMessagesAsync(int conversationId);
        Task<PrivateMessage?> GetLatestNonDeletedMessageAsync(int conversationId);
        Task SetMessagePinnedAsync(PrivateMessage message, bool isPinned, DateTime? pinnedAt);
        Task<IReadOnlyList<PrivateMessageReaction>> AddOrUpdateReactionAsync(int messageId, string userId, string emoji);
        Task<IReadOnlyList<PrivateMessageReaction>> RemoveReactionAsync(int messageId, string userId);
        Task<bool> ShouldTreatReactionAsNewNotificationAsync(int messageId, string reactorUserId);
    }
}
