using SportsBookingAPI.DTOs;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Helpers
{
    public static class UserMappingHelper
    {
        public static UserProfileDto ToUserProfileDto(AppUser user)
        {
            return new UserProfileDto
            {
                Id = user.Id,
                Username = user.UserName,
                FullName = user.FullName,
                PhoneNumber = user.PhoneNumber,
                ProfilePictureUrl = user.ProfilePictureUrl,
                Location = user.CityRef?.Name ?? string.Empty,
                CityId = user.CityId
            };
        }
    }
}
