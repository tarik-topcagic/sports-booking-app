using SportsBookingAPI.Models;

namespace SportsBookingAPI.Interfaces
{
    public interface ICityRepository
    {
        Task<IEnumerable<City>> GetAllCitiesAsync();
        Task<City?> GetCityByIdAsync(int id);
        Task<City> CreateCityAsync(City city);
        Task<bool> DeleteCityAsync(int id);
    }
}
