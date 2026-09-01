namespace SportsBookingAPI.Models
{
    public class GroupMessageReactionNotification
    {
        public int Id { get; set; }
        public int GroupMessageId { get; set; }
        public string ReactorUserId { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public virtual GroupMessage GroupMessage { get; set; } = null!;
        public virtual AppUser ReactorUser { get; set; } = null!;
    }
}
