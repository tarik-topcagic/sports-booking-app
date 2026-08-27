using SportsBookingAPI.DTOs;
using SportsBookingAPI.Interfaces;
using System.Collections.Concurrent;

namespace SportsBookingAPI.Services
{
    public class TypingTrackingService : ITypingTrackingService
    {
        private readonly ConcurrentDictionary<string, ChatTypingDto> _typingByConnection = new();

        public void SetTyping(string connectionId, ChatTypingDto typingInfo)
        {
            _typingByConnection[connectionId] = typingInfo;
        }

        public ChatTypingDto? ClearTyping(string connectionId)
        {
            return _typingByConnection.TryRemove(connectionId, out var typingInfo)
                ? typingInfo
                : null;
        }
    }
}
