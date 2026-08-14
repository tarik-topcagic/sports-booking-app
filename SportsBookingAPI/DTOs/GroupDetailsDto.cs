namespace SportsBookingAPI.DTOs
{
    public class GroupDetailsDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public string SportCategory { get; set; } = string.Empty;
        public string ImageUrl { get; set; } = string.Empty;
        public string AdminDisplayName { get; set; } = string.Empty;
        public string CurrentUserId { get; set; } = string.Empty;
        public DateTime DateCreated { get; set; }
        public int MembersCount { get; set; }
        public bool IsAdmin { get; set; }
        public bool IsMember { get; set; }
        public bool HasPendingJoinRequest { get; set; }
        public bool HasPendingInvitation { get; set; }
        public int? PendingInvitationMembershipId { get; set; }
        public List<GroupMemberDto> Members { get; set; } = new();
    }

    public class GroupMemberDto
    {
        public string UserId { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string ProfilePictureUrl { get; set; } = string.Empty;
        public bool IsAdmin { get; set; }
    }
}
