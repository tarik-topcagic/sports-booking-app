namespace SportsBookingAPI.DTOs
{
    public class ChatMessageNotificationDto
    {
        public string Type { get; set; } = string.Empty;
        public int? GroupId { get; set; }
        public string? GroupName { get; set; }
        public int? ConversationId { get; set; }
        public string SenderUserId { get; set; } = string.Empty;
        public string SenderName { get; set; } = string.Empty;
        public string Preview { get; set; } = string.Empty;
        public DateTimeOffset CreatedAt { get; set; }
        public string Kind { get; set; } = "message";
        public string? ReactionEmoji { get; set; }
    }
}
