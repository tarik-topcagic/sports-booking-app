using SportsBookingAPI.Models;

namespace SportsBookingAPI.Interfaces
{
    public interface ICantonService
    {
        Task<IEnumerable<Canton>> GetAllCantonsAsync();
    }
}
