using SportsBookingAPI.DTOs;
using SportsBookingAPI.DTOs.Admin;
using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Services
{
    public class CityService : ICityService
    {
        private readonly ICityRepository _cityRepository;
        private readonly ICantonRepository _cantonRepository;
        private readonly IArenaRepository _arenaRepository;
        private readonly IGroupRepository _groupRepository;
        private readonly IUserRepository _userRepository;

        public CityService(
            ICityRepository cityRepository,
            ICantonRepository cantonRepository,
            IArenaRepository arenaRepository,
            IGroupRepository groupRepository,
            IUserRepository userRepository)
        {
            _cityRepository = cityRepository;
            _cantonRepository = cantonRepository;
            _arenaRepository = arenaRepository;
            _groupRepository = groupRepository;
            _userRepository = userRepository;
        }

        public async Task<IEnumerable<CityDto>> GetAllCitiesAsync()
        {
            var cities = await _cityRepository.GetAllCitiesAsync();
            return cities.Select(MapCity);
        }

        public async Task<ServiceResult> CreateCityAsync(CreateCityDto createCityDto)
        {
            var trimmedName = createCityDto.Name.Trim();

            var nameExists = await _cityRepository.ExistsByNameAsync(trimmedName);
            if (nameExists)
                return ServiceResult.BadRequest(new { field = "name", message = "A city with this name already exists." });

            var canton = await _cantonRepository.GetCantonByIdAsync(createCityDto.CantonId);
            if (canton == null)
                return ServiceResult.BadRequest(new { field = "cantonId", message = "Selected canton does not exist." });

            var city = new City
            {
                Name = trimmedName,
                CantonId = canton.Id,
                CantonRef = canton,
            };

            var createdCity = await _cityRepository.CreateCityAsync(city);
            return ServiceResult.Ok(MapCity(createdCity));
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

        private static CityDto MapCity(City city)
        {
            return new CityDto
            {
                Id = city.Id,
                Name = city.Name,
                Canton = city.CantonRef.Name,
                CantonId = city.CantonId
            };
        }
    }
}
