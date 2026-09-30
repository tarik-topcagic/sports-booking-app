using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Services
{
    public class CantonService : ICantonService
    {
        private readonly ICantonRepository _cantonRepository;

        public CantonService(ICantonRepository cantonRepository)
        {
            _cantonRepository = cantonRepository;
        }

        public async Task<IEnumerable<Canton>> GetAllCantonsAsync()
        {
            return await _cantonRepository.GetAllCantonsAsync();
        }
    }
}
