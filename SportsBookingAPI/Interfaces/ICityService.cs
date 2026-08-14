using SportsBookingAPI.Models;

namespace SportsBookingAPI.Interfaces
{
    public interface ICityService
    {
        Task<IEnumerable<City>> GetAllCitiesAsync();
    }
}
