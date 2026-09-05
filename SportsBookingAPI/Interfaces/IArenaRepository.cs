using SportsBookingAPI.Models;

namespace SportsBookingAPI.Interfaces
{
    public interface IArenaRepository
    {
        Task<IEnumerable<Arena>> GetArenasAsync(string? city, string? sportType, string? searchTerm);
        Task<IEnumerable<(Arena Arena, int ReservationCount, int FavoriteCount)>> GetAllArenasWithCountsAsync(string? name, string? city, string? sportType);
        Task<(IEnumerable<string> Cities, IEnumerable<string> Sports)> GetDistinctCitiesAndSportsAsync();
        Task<Arena?> GetArenaByIdAsync(int id);
        Task<Arena> CreateArenaAsync(Arena arena);
        Task<Arena> UpdateArenaAsync(Arena arena);
        Task DeleteArenaAsync(Arena arena);
        Task<bool> CityHasArenasAsync(int cityId);
    }
}
