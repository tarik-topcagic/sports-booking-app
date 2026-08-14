using Microsoft.EntityFrameworkCore;
using SportsBookingAPI.Data;
using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Repositories
{
    public class CityRepository : ICityRepository
    {
        private readonly ApplicationDBContext _context;
        public CityRepository(ApplicationDBContext context)
        {
            _context = context;
        }

        public async Task<IEnumerable<City>> GetAllCitiesAsync()
        {
            return await _context.Cities.ToListAsync();
        }
    }
}
