using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore.Storage;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Interfaces
{
    public interface IUserRepository
    {
        Task<AppUser?> GetUserByIdAsync(string id);
        Task<AppUser?> GetUserByNormalizedUsernameAsync(string normalizedUsername);
        Task<AppUser?> GetUserByHistoricalUsernameAsync(string normalizedUsername);
        Task<bool> UsernameExistsAsync(string normalizedUsername, string excludedUserId);
        Task<IdentityResult> UpdateUserAsync(AppUser user);
        Task<IdentityResult> UpdateSecurityStampAsync(AppUser user);
        Task<List<AppUser>> GetAllUsersAsync();
        Task<List<AppUser>> GetAllUsersForAdminAsync(string? username);
        Task<List<AppUser>> SearchUsersAsync(string? searchTerm);
        Task<IDbContextTransaction> BeginTransactionAsync();
        Task AddUsernameHistoryAsync(UsernameHistory entry);
    }
}
