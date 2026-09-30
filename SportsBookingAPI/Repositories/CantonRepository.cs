using Microsoft.EntityFrameworkCore;
using SportsBookingAPI.Data;
using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Repositories
{
    public class CantonRepository : ICantonRepository
    {
        private readonly ApplicationDBContext _context;
        public CantonRepository(ApplicationDBContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<Canton>> GetAllCantonsAsync()
        {
            return await _context.Cantons.OrderBy(c => c.Id).ToListAsync();
        }

        public async Task<Canton?> GetCantonByIdAsync(int id)
        {
            return await _context.Cantons.FirstOrDefaultAsync(c => c.Id == id);
        }

        public async Task<bool> ExistsByIdAsync(int id)
        {
            return await _context.Cantons.AnyAsync(c => c.Id == id);
        }
    }
}
