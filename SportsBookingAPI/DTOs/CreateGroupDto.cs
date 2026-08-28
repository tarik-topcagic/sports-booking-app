namespace SportsBookingAPI.DTOs
{
    public class CreateGroupDto
    {
        public string Name { get; set; }
        public string Description { get; set; }
        public string City { get; set; } = string.Empty;
        public string SportCategory { get; set; } = string.Empty;
        public string ImageUrl { get; set; }
    }
}
