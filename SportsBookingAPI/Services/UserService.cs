using Microsoft.AspNetCore.Identity;
using SportsBookingAPI.DTOs;
using SportsBookingAPI.DTOs.Admin;
using SportsBookingAPI.Helpers;
using SportsBookingAPI.Helpers.Admin;
using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Services
{
    public class UserService : IUserService
    {
        private readonly IUserRepository _userRepository;
        private readonly UserManager<AppUser> _userManager;

        public UserService(IUserRepository userRepository, UserManager<AppUser> userManager)
        {
            _userRepository = userRepository;
            _userManager = userManager;
        }

        public async Task<UserProfileDto?> GetMyProfileAsync(string userId)
        {
            var user = await _userRepository.GetUserByIdAsync(userId);
            return user == null ? null : UserMappingHelper.ToUserProfileDto(user);
        }

        public async Task<UserProfileLookupResult> GetUserProfileByUsernameAsync(string username)
        {
            var normalizedUsername = _userManager.NormalizeName(username.Trim());
            var user = await _userRepository.GetUserByNormalizedUsernameAsync(normalizedUsername);
            if (user != null)
                return UserProfileLookupResult.Found(UserMappingHelper.ToUserProfileDto(user));

            var historicalOwner = await _userRepository.GetUserByHistoricalUsernameAsync(normalizedUsername);
            if (historicalOwner?.UserName != null)
                return UserProfileLookupResult.Redirect(historicalOwner.UserName);

            return UserProfileLookupResult.NotFound();
        }

        public async Task<IEnumerable<UserProfileDto>> SearchUsersAsync(string? query, string? currentUserId)
        {
            if (string.IsNullOrWhiteSpace(query))
            {
                var allUsers = await _userRepository.GetAllUsersAsync();
                return allUsers
                    .Where(user => user.Id != currentUserId)
                    .Select(UserMappingHelper.ToUserProfileDto);
            }

            var loweredQuery = query.ToLower();
            var users = await _userRepository.SearchUsersAsync(query);

            return users
                .Where(user => user.Id != currentUserId
                    || (user.Id == currentUserId
                        && ((user.UserName != null && user.UserName.ToLower().Contains(loweredQuery))
                            || (user.FullName != null && user.FullName.ToLower().Contains(loweredQuery)))))
                .Select(UserMappingHelper.ToUserProfileDto);
        }

        public async Task<IEnumerable<AdminUserDto>> GetAllUsersForAdminAsync(string? username, string? role, bool? locked)
        {
            var users = await _userRepository.GetAllUsersForAdminAsync(username);
            var result = new List<AdminUserDto>();

            foreach (var user in users)
            {
                var roles = await _userManager.GetRolesAsync(user);
                result.Add(AdminUserMappingHelper.ToAdminUserDto(user, roles));
            }

            if (!string.IsNullOrWhiteSpace(role))
            {
                var wantsAdmin = string.Equals(role, "Admin", StringComparison.OrdinalIgnoreCase);
                result = result.Where(u => u.Roles.Contains("Admin") == wantsAdmin).ToList();
            }

            if (locked.HasValue)
            {
                result = result
                    .Where(u => IsUserLocked(u.LockoutEnd) == locked.Value)
                    .ToList();
            }

            return result;
        }

        private static bool IsUserLocked(DateTimeOffset? lockoutEnd)
        {
            return lockoutEnd.HasValue && lockoutEnd.Value > DateTimeOffset.UtcNow;
        }

        public async Task<ServiceResult> SetUserLockoutAsync(string userId, bool locked, string callerId)
        {
            if (locked && string.Equals(userId, callerId, StringComparison.Ordinal))
                return ServiceResult.BadRequest("You cannot lock your own account.");

            var user = await _userRepository.GetUserByIdAsync(userId);
            if (user == null)
                return ServiceResult.NotFound("User not found");

            var result = await _userManager.SetLockoutEnabledAsync(user, true);
            if (!result.Succeeded)
                return ServiceResult.BadRequest(result.Errors.Select(e => e.Description));

            var lockoutResult = await _userManager.SetLockoutEndDateAsync(user, locked ? DateTimeOffset.MaxValue : (DateTimeOffset?)null);
            if (!lockoutResult.Succeeded)
                return ServiceResult.BadRequest(lockoutResult.Errors.Select(e => e.Description));

            return ServiceResult.Ok(new { message = locked ? "User locked" : "User unlocked" });
        }
    }
}
