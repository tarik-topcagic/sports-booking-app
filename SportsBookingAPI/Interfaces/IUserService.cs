using SportsBookingAPI.DTOs;
using SportsBookingAPI.DTOs.Admin;
using SportsBookingAPI.Services;

namespace SportsBookingAPI.Interfaces
{
    public interface IUserService
    {
        Task<UserProfileDto?> GetMyProfileAsync(string userId);
        Task<UserProfileLookupResult> GetUserProfileByUsernameAsync(string username);
        Task<IEnumerable<UserProfileDto>> SearchUsersAsync(string? query, string? currentUserId);
        Task<IEnumerable<AdminUserDto>> GetAllUsersForAdminAsync(string? username, string? role, bool? locked);
        Task<ServiceResult> SetUserLockoutAsync(string userId, bool locked, string callerId);
    }
}
