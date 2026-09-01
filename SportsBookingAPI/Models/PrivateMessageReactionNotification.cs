namespace SportsBookingAPI.Models
{
    public class PrivateMessageReactionNotification
    {
        public int Id { get; set; }
        public int PrivateMessageId { get; set; }
        public string ReactorUserId { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public virtual PrivateMessage PrivateMessage { get; set; } = null!;
        public virtual AppUser ReactorUser { get; set; } = null!;
    }
}
