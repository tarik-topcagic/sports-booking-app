using SportsBookingAPI.DTOs.Admin;
using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Services
{
    public class CityService : ICityService
    {
        private readonly ICityRepository _cityRepository;
        private readonly IArenaRepository _arenaRepository;
        private readonly IGroupRepository _groupRepository;
        private readonly IUserRepository _userRepository;

        public CityService(
            ICityRepository cityRepository,
            IArenaRepository arenaRepository,
            IGroupRepository groupRepository,
            IUserRepository userRepository)
        {
            _cityRepository = cityRepository;
            _arenaRepository = arenaRepository;
            _groupRepository = groupRepository;
            _userRepository = userRepository;
        }

        public async Task<IEnumerable<City>> GetAllCitiesAsync()
        {
            return await _cityRepository.GetAllCitiesAsync();
        }

        public async Task<ServiceResult> CreateCityAsync(CreateCityDto createCityDto)
        {
            var trimmedName = createCityDto.Name.Trim();

            var nameExists = await _cityRepository.ExistsByNameAsync(trimmedName);
            if (nameExists)
                return ServiceResult.BadRequest(new { field = "name", message = "A city with this name already exists." });

            var city = new City
            {
                Name = trimmedName,
                Canton = createCityDto.Canton
            };

            var createdCity = await _cityRepository.CreateCityAsync(city);
            return ServiceResult.Ok(createdCity);
        }

        public async Task<ServiceResult> DeleteCityAsync(int id)
        {
            var hasArenas = await _arenaRepository.CityHasArenasAsync(id);
            var hasGroups = await _groupRepository.CityHasGroupsAsync(id);
            var hasUsers = await _userRepository.CityHasUsersAsync(id);

            var dependents = new List<string>();
            if (hasArenas) dependents.Add("arenas");
            if (hasGroups) dependents.Add("groups");
            if (hasUsers) dependents.Add("users");

            if (dependents.Count > 0)
                return ServiceResult.BadRequest($"Cannot delete this city because it is used by one or more {JoinDependentNames(dependents)}.");

            var wasDeleted = await _cityRepository.DeleteCityAsync(id);
            if (!wasDeleted)
                return ServiceResult.NotFound("City not found");

            return ServiceResult.Ok(new { message = "City deleted successfully" });
        }

        private static string JoinDependentNames(IReadOnlyList<string> names)
        {
            if (names.Count == 1)
                return names[0];

            return $"{string.Join(", ", names.Take(names.Count - 1))} and {names[^1]}";
        }
    }
}
