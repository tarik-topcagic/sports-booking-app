using SportsBookingAPI.DTOs;

namespace SportsBookingAPI.Interfaces
{
    public interface ITypingTrackingService
    {
        void SetTyping(string connectionId, ChatTypingDto typingInfo);
        ChatTypingDto? ClearTyping(string connectionId);
    }
}
