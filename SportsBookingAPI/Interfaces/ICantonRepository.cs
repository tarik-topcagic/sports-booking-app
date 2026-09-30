using SportsBookingAPI.Models;

namespace SportsBookingAPI.Interfaces
{
    public interface ICantonRepository
    {
        Task<IEnumerable<Canton>> GetAllCantonsAsync();
        Task<Canton?> GetCantonByIdAsync(int id);
        Task<bool> ExistsByIdAsync(int id);
    }
}
