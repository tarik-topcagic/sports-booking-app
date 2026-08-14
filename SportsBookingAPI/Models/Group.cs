namespace SportsBookingAPI.Models
{
    public class Group
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public string Description { get; set; }
        public string City { get; set; } = string.Empty;
        public string SportCategory { get; set; } = string.Empty;
        public string AdminId { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime DateCreated { get; set; } = DateTime.UtcNow;
        public string ImageUrl { get; set; } = "default-group.png"; 
        public virtual AppUser Admin {  get; set; }
        public virtual ICollection<GroupMembership> Memberships { get; set; } = new List<GroupMembership>();
        public virtual ICollection<GroupMessage> GroupMessages { get; set; } = new List<GroupMessage>();
    }
}
