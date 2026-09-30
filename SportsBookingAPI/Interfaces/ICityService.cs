using SportsBookingAPI.DTOs;
using SportsBookingAPI.DTOs.Admin;
using SportsBookingAPI.Services;

namespace SportsBookingAPI.Interfaces
{
    public interface ICityService
    {
        Task<IEnumerable<CityDto>> GetAllCitiesAsync();
        Task<ServiceResult> CreateCityAsync(CreateCityDto createCityDto);
        Task<ServiceResult> DeleteCityAsync(int id);
    }
}
