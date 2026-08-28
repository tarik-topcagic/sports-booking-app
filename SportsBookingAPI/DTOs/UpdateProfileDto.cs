namespace SportsBookingAPI.DTOs
{
    public class UpdateProfileDto
    {
        public string FullName { get; set; }
        public string? ProfilePictureUrl { get; set; } = string.Empty;
        public string PhoneNumber { get; set; }
        public string? Location { get; set; } = string.Empty;
    }
}
