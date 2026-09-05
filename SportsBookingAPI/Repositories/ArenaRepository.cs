using Microsoft.EntityFrameworkCore;
using SportsBookingAPI.Data;
using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Repositories
{
    public class ArenaRepository : IArenaRepository
    {
        private readonly ApplicationDBContext _context;

        public ArenaRepository(ApplicationDBContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<Arena>> GetArenasAsync(string? city, string? sportType, string? searchTerm)
        {
            var query = _context.Arenas.AsNoTracking().Include(arena => arena.CityRef).AsQueryable();

            if (!string.IsNullOrWhiteSpace(city))
            {
                var normalizedCity = city.Trim().ToLower();
                query = query.Where(arena => arena.CityRef.Name.ToLower() == normalizedCity);
            }

            if (!string.IsNullOrWhiteSpace(sportType))
            {
                var normalizedSportType = sportType.Trim().ToLower();
                query = query.Where(arena => arena.SportType.ToLower() == normalizedSportType);
            }

            if (!string.IsNullOrWhiteSpace(searchTerm))
            {
                var normalizedSearchTerm = searchTerm.Trim().ToLower();
                query = query.Where(arena =>
                    arena.Name.ToLower().Contains(normalizedSearchTerm) ||
                    arena.Description.ToLower().Contains(normalizedSearchTerm) ||
                    arena.Address.ToLower().Contains(normalizedSearchTerm) ||
                    arena.CityRef.Name.ToLower().Contains(normalizedSearchTerm) ||
                    arena.SportType.ToLower().Contains(normalizedSearchTerm));
            }

            return await query
                .OrderBy(arena => arena.CityRef.Name)
                .ThenBy(arena => arena.Name)
                .ToListAsync();
        }

        public async Task<IEnumerable<(Arena Arena, int ReservationCount, int FavoriteCount)>> GetAllArenasWithCountsAsync(string? name, string? city, string? sportType)
        {
            var query = _context.Arenas.AsNoTracking().Include(arena => arena.CityRef).AsQueryable();

            if (!string.IsNullOrWhiteSpace(name))
            {
                var normalizedName = name.Trim().ToLower();
                query = query.Where(arena => arena.Name.ToLower().Contains(normalizedName));
            }

            if (!string.IsNullOrWhiteSpace(city))
                query = query.Where(arena => arena.CityRef.Name == city);

            if (!string.IsNullOrWhiteSpace(sportType))
                query = query.Where(arena => arena.SportType == sportType);

            var arenas = await query
                .OrderBy(arena => arena.CityRef.Name)
                .ThenBy(arena => arena.Name)
                .ToListAsync();

            var reservationCounts = await _context.Reservations
                .GroupBy(r => r.ArenaId)
                .Select(g => new { ArenaId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.ArenaId, x => x.Count);

            var favoriteCounts = await _context.FavoriteArenas
                .GroupBy(f => f.ArenaId)
                .Select(g => new { ArenaId = g.Key, Count = g.Count() })
                .ToDictionaryAsync(x => x.ArenaId, x => x.Count);

            return arenas.Select(arena => (
                arena,
                reservationCounts.TryGetValue(arena.Id, out var reservationCount) ? reservationCount : 0,
                favoriteCounts.TryGetValue(arena.Id, out var favoriteCount) ? favoriteCount : 0
            ));
        }

        public async Task<(IEnumerable<string> Cities, IEnumerable<string> Sports)> GetDistinctCitiesAndSportsAsync()
        {
            var cities = await _context.Arenas
                .Select(a => a.CityRef.Name)
                .Distinct()
                .OrderBy(c => c)
                .ToListAsync();

            var sports = await _context.Arenas
                .Where(a => a.SportType != null && a.SportType != string.Empty)
                .Select(a => a.SportType)
                .Distinct()
                .OrderBy(s => s)
                .ToListAsync();

            return (cities, sports);
        }

        public async Task<Arena?> GetArenaByIdAsync(int id)
        {
            return await _context.Arenas
                .AsNoTracking()
                .Include(arena => arena.CityRef)
                .FirstOrDefaultAsync(arena => arena.Id == id);
        }

        public async Task<Arena> CreateArenaAsync(Arena arena)
        {
            _context.Arenas.Add(arena);
            await _context.SaveChangesAsync();
            return arena;
        }

        public async Task<Arena> UpdateArenaAsync(Arena arena)
        {
            _context.Arenas.Update(arena);
            await _context.SaveChangesAsync();
            return arena;
        }

        public async Task DeleteArenaAsync(Arena arena)
        {
            _context.Arenas.Remove(arena);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> CityHasArenasAsync(int cityId)
        {
            return await _context.Arenas.AnyAsync(a => a.CityId == cityId);
        }
    }
}
