using SportsBookingAPI.DTOs;

namespace SportsBookingAPI.Services
{
    public class UserProfileLookupResult
    {
        public UserProfileDto? Profile { get; init; }
        public string? RedirectUsername { get; init; }

        public static UserProfileLookupResult Found(UserProfileDto profile) => new() { Profile = profile };
        public static UserProfileLookupResult Redirect(string username) => new() { RedirectUsername = username };
        public static UserProfileLookupResult NotFound() => new();
    }
}
