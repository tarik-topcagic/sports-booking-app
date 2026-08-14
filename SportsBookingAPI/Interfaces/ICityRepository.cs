using SportsBookingAPI.Models;

namespace SportsBookingAPI.Interfaces
{
    public interface ICityRepository
    {
        Task<IEnumerable<City>> GetAllCitiesAsync();
    }
}
