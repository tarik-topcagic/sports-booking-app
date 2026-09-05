using SportsBookingAPI.DTOs.Admin;
using SportsBookingAPI.Models;
using SportsBookingAPI.Services;

namespace SportsBookingAPI.Interfaces
{
    public interface ICityService
    {
        Task<IEnumerable<City>> GetAllCitiesAsync();
        Task<ServiceResult> CreateCityAsync(CreateCityDto createCityDto);
        Task<ServiceResult> DeleteCityAsync(int id);
    }
}
