using Microsoft.EntityFrameworkCore;
using SportsBookingAPI.Data;
using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Repositories
{
    public class FavoriteArenaRepository : IFavoriteArenaRepository
    {
        private readonly ApplicationDBContext _context;

        public FavoriteArenaRepository(ApplicationDBContext context)
        {
            _context = context;
        }

        public async Task<FavoriteArena> AddAsync(FavoriteArena favoriteArena)
        {
            _context.FavoriteArenas.Add(favoriteArena);
            await _context.SaveChangesAsync();
            return favoriteArena;
        }

        public async Task<FavoriteArena?> GetAsync(string userId, int arenaId)
        {
            return await _context.FavoriteArenas
                .FirstOrDefaultAsync(f => f.UserId == userId && f.ArenaId == arenaId);
        }

        public async Task<IEnumerable<FavoriteArena>> GetForUserAsync(string userId)
        {
            return await _context.FavoriteArenas
                .Include(f => f.Arena)
                .ThenInclude(a => a.CityRef)
                .Where(f => f.UserId == userId)
                .OrderByDescending(f => f.CreatedAt)
                .ToListAsync();
        }

        public async Task RemoveAsync(int id)
        {
            var favoriteArena = await _context.FavoriteArenas.FindAsync(id);
            if (favoriteArena != null)
            {
                _context.FavoriteArenas.Remove(favoriteArena);
                await _context.SaveChangesAsync();
            }
        }

        public async Task<bool> ArenaHasFavoritesAsync(int arenaId)
        {
            return await _context.FavoriteArenas.AnyAsync(f => f.ArenaId == arenaId);
        }
    }
}
