namespace SportsBookingAPI.DTOs
{
    public class UserSettingsDto
    {
        public string Username { get; set; } = string.Empty;
        public string Email { get; set; } = string.Empty;
        public string PhoneNumber { get; set; } = string.Empty;
        public bool EmailNotificationsEnabled { get; set; }
        public string LanguagePreference { get; set; } = "en";
    }
}
