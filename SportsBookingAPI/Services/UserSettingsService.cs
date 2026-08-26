using Microsoft.AspNetCore.Identity;
using SportsBookingAPI.DTOs;
using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Services
{
    public class UserSettingsService : IUserSettingsService
    {
        private static readonly HashSet<string> SupportedLanguagePreferences = new(StringComparer.OrdinalIgnoreCase)
        {
            "bs", "en", "de", "hr", "sr", "es", "fr", "it"
        };

        private readonly IUserRepository _userRepository;
        private readonly UserManager<AppUser> _userManager;
        private readonly ITokenService _tokenService;

        public UserSettingsService(IUserRepository userRepository, UserManager<AppUser> userManager, ITokenService tokenService)
        {
            _userRepository = userRepository;
            _userManager = userManager;
            _tokenService = tokenService;
        }

        public async Task<UserSettingsDto?> GetSettingsAsync(string userId)
        {
            var user = await _userRepository.GetUserByIdAsync(userId);
            if (user == null)
                return null;

            return new UserSettingsDto
            {
                Username = user.UserName ?? string.Empty,
                Email = user.Email ?? string.Empty,
                PhoneNumber = user.PhoneNumber ?? string.Empty,
                EmailNotificationsEnabled = user.EmailNotificationsEnabled,
                LanguagePreference = NormalizeLanguagePreference(user.LanguagePreference)
            };
        }

        public async Task<ServiceResult> UpdateEmailNotificationsAsync(string userId, UpdateEmailNotificationsDto dto)
        {
            var user = await _userRepository.GetUserByIdAsync(userId);
            if (user == null)
                return ServiceResult.NotFound();

            user.EmailNotificationsEnabled = dto.EmailNotificationsEnabled;

            var result = await _userRepository.UpdateUserAsync(user);
            if (!result.Succeeded)
                return ServiceResult.BadRequest(result.Errors);

            return ServiceResult.Ok(new { message = "Notification settings saved." });
        }

        public async Task<ServiceResult> UpdateLanguagePreferenceAsync(string userId, UpdateLanguagePreferenceDto dto)
        {
            var user = await _userRepository.GetUserByIdAsync(userId);
            if (user == null)
                return ServiceResult.NotFound();

            var normalizedLanguagePreference = NormalizeLanguagePreference(dto.LanguagePreference);
            if (!SupportedLanguagePreferences.Contains(normalizedLanguagePreference))
                return ServiceResult.BadRequest(new { field = "languagePreference", message = "Unsupported application language." });

            user.LanguagePreference = normalizedLanguagePreference;

            var result = await _userRepository.UpdateUserAsync(user);
            if (!result.Succeeded)
                return ServiceResult.BadRequest(result.Errors);

            return ServiceResult.Ok(new
            {
                message = "Application language saved.",
                languagePreference = normalizedLanguagePreference
            });
        }

        public async Task<ServiceResult> UpdateUsernameAsync(string userId, UpdateUsernameDto dto)
        {
            var newUsername = dto.Username.Trim();
            if (string.IsNullOrWhiteSpace(newUsername))
                return ServiceResult.BadRequest(new { field = "username", message = "Username is required." });

            var user = await _userRepository.GetUserByIdAsync(userId);
            if (user == null)
                return ServiceResult.NotFound();

            if (string.Equals(user.UserName, newUsername, StringComparison.Ordinal))
            {
                var currentToken = await _tokenService.GenerateJwtToken(user);
                return ServiceResult.Ok(new { token = currentToken, username = user.UserName, fullName = user.FullName });
            }

            var normalizedUsername = _userManager.NormalizeName(newUsername);
            var usernameExists = await _userRepository.UsernameExistsAsync(normalizedUsername, user.Id);

            if (usernameExists)
                return ServiceResult.BadRequest(new { field = "username", message = "Username is already taken" });

            var oldUsername = user.UserName!;
            var oldNormalizedUsername = user.NormalizedUserName!;

            user.UserName = newUsername;
            user.NormalizedUserName = normalizedUsername;

            await using var transaction = await _userRepository.BeginTransactionAsync();

            var updateResult = await _userRepository.UpdateUserAsync(user);
            if (!updateResult.Succeeded)
            {
                await transaction.RollbackAsync();
                return ServiceResult.BadRequest(updateResult.Errors);
            }

            await _userRepository.AddUsernameHistoryAsync(new UsernameHistory
            {
                UserId = user.Id,
                OldUsername = oldUsername,
                OldNormalizedUsername = oldNormalizedUsername,
                ChangedAt = DateTime.UtcNow,
            });

            await transaction.CommitAsync();

            var stampResult = await _userRepository.UpdateSecurityStampAsync(user);
            if (!stampResult.Succeeded)
                return ServiceResult.BadRequest(stampResult.Errors);

            var updatedUser = await _userRepository.GetUserByIdAsync(user.Id);
            if (updatedUser == null)
                return ServiceResult.NotFound();

            var token = await _tokenService.GenerateJwtToken(updatedUser);

            return ServiceResult.Ok(new
            {
                token,
                username = updatedUser.UserName,
                fullName = updatedUser.FullName
            });
        }

        private static string NormalizeLanguagePreference(string? languagePreference)
        {
            if (string.IsNullOrWhiteSpace(languagePreference))
                return "bs";

            return languagePreference.Trim().ToLowerInvariant();
        }
    }
}
