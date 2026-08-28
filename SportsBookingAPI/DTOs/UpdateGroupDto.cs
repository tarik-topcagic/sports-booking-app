namespace SportsBookingAPI.DTOs
{
    public class UpdateGroupDto
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public string City { get; set; } = string.Empty;
        public string SportCategory { get; set; } = string.Empty;
        public string? GroupPictureUrl { get; set; } = string.Empty;
    }
}
