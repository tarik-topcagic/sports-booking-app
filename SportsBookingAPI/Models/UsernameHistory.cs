namespace SportsBookingAPI.Models
{
    public class UsernameHistory
    {
        public int Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public string OldUsername { get; set; } = string.Empty;
        public string OldNormalizedUsername { get; set; } = string.Empty;
        public DateTime ChangedAt { get; set; } = DateTime.UtcNow;
        public virtual AppUser User { get; set; } = null!;
    }
}
