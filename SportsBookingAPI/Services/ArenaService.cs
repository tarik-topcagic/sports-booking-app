using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using SportsBookingAPI.DTOs;
using SportsBookingAPI.DTOs.Admin;
using SportsBookingAPI.Helpers;
using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Services
{
    public class ArenaService : IArenaService
    {
        private readonly IArenaRepository _arenaRepository;
        private readonly IReservationRepository _reservationRepository;
        private readonly IFavoriteArenaRepository _favoriteArenaRepository;
        private readonly ICityRepository _cityRepository;
        private readonly IConfiguration _configuration;

        public ArenaService(
            IArenaRepository arenaRepository,
            IReservationRepository reservationRepository,
            IFavoriteArenaRepository favoriteArenaRepository,
            ICityRepository cityRepository,
            IConfiguration configuration)
        {
            _arenaRepository = arenaRepository;
            _reservationRepository = reservationRepository;
            _favoriteArenaRepository = favoriteArenaRepository;
            _cityRepository = cityRepository;
            _configuration = configuration;
        }

        public async Task<IEnumerable<ArenaDto>> GetArenasAsync(string? city, string? sportType, string? searchTerm)
        {
            var arenas = await _arenaRepository.GetArenasAsync(city, sportType, searchTerm);
            return arenas.Select(MapArena);
        }

        public async Task<ArenaDto?> GetArenaByIdAsync(int id)
        {
            var arena = await _arenaRepository.GetArenaByIdAsync(id);
            return arena == null ? null : MapArena(arena);
        }

        public async Task<IEnumerable<AdminArenaDto>> GetAllArenasForAdminAsync(string? name, string? city, string? sportType)
        {
            var arenasWithCounts = await _arenaRepository.GetAllArenasWithCountsAsync(name, city, sportType);
            return arenasWithCounts.Select(x => new AdminArenaDto
            {
                Id = x.Arena.Id,
                Name = x.Arena.Name,
                Description = x.Arena.Description,
                City = x.Arena.CityRef.Name,
                SportType = x.Arena.SportType,
                Address = x.Arena.Address,
                ImageUrl = x.Arena.ImageUrl,
                PricePerHour = x.Arena.PricePerHour,
                CreatedAt = x.Arena.CreatedAt,
                ReservationCount = x.ReservationCount,
                FavoriteCount = x.FavoriteCount
            });
        }

        public async Task<(IEnumerable<string> Cities, IEnumerable<string> Sports)> GetArenaFilterOptionsAsync()
        {
            return await _arenaRepository.GetDistinctCitiesAndSportsAsync();
        }

        public async Task<IEnumerable<TimeRangeDto>?> GetAvailabilityAsync(int arenaId, DateTime dateUtc)
        {
            var arena = await _arenaRepository.GetArenaByIdAsync(arenaId);
            if (arena == null)
                return null;

            return await _reservationRepository.GetConfirmedReservationsForArenaOnDateAsync(arenaId, dateUtc);
        }

        public async Task<ServiceResult> CreateArenaAsync(CreateArenaDto createArenaDto)
        {
            var city = await _cityRepository.GetCityByIdAsync(createArenaDto.CityId);
            if (city == null)
                return ServiceResult.BadRequest("Selected city was not found.");

            var arena = new Arena
            {
                Name = createArenaDto.Name,
                Description = createArenaDto.Description,
                CityId = city.Id,
                CityRef = city,
                SportType = createArenaDto.SportType,
                Address = createArenaDto.Address,
                PricePerHour = createArenaDto.PricePerHour,
                ImageUrl = string.Empty,
                CreatedAt = DateTime.UtcNow
            };

            var createdArena = await _arenaRepository.CreateArenaAsync(arena);
            return ServiceResult.Ok(MapArena(createdArena));
        }

        public async Task<ServiceResult> UpdateArenaAsync(int id, UpdateArenaDto updateArenaDto)
        {
            var arena = await _arenaRepository.GetArenaByIdAsync(id);
            if (arena == null)
                return ServiceResult.NotFound("Arena not found");

            var city = await _cityRepository.GetCityByIdAsync(updateArenaDto.CityId);
            if (city == null)
                return ServiceResult.BadRequest("Selected city was not found.");

            arena.Name = updateArenaDto.Name;
            arena.Description = updateArenaDto.Description;
            arena.CityId = city.Id;
            arena.CityRef = city;
            arena.SportType = updateArenaDto.SportType;
            arena.Address = updateArenaDto.Address;
            arena.PricePerHour = updateArenaDto.PricePerHour;

            var updatedArena = await _arenaRepository.UpdateArenaAsync(arena);
            return ServiceResult.Ok(MapArena(updatedArena));
        }

        public async Task<ServiceResult> DeleteArenaAsync(int id)
        {
            var arena = await _arenaRepository.GetArenaByIdAsync(id);
            if (arena == null)
                return ServiceResult.NotFound("Arena not found");

            var hasReservations = await _reservationRepository.ArenaHasReservationsAsync(id);
            if (hasReservations)
                return ServiceResult.BadRequest("Cannot delete this arena because it has existing reservations.");

            var hasFavorites = await _favoriteArenaRepository.ArenaHasFavoritesAsync(id);
            if (hasFavorites)
                return ServiceResult.BadRequest("Cannot delete this arena because it is favorited by one or more users.");

            try
            {
                await _arenaRepository.DeleteArenaAsync(arena);
            }
            catch (DbUpdateException)
            {
                return ServiceResult.BadRequest("Cannot delete this arena because it is still referenced by other records.");
            }

            return ServiceResult.Ok(new { message = "Arena deleted successfully" });
        }

        public async Task<ServiceResult> UploadArenaPictureAsync(int arenaId, IFormFile file, string scheme, HostString host)
        {
            var arena = await _arenaRepository.GetArenaByIdAsync(arenaId);
            if (arena == null)
                return ServiceResult.NotFound("Arena not found");

            if (file == null || file.Length == 0)
                return ServiceResult.BadRequest("No picture selected");

            var uploadsFolder = UploadPathHelper.GetUploadsSubfolder(_configuration, "arena");
            if (!Directory.Exists(uploadsFolder))
                Directory.CreateDirectory(uploadsFolder);

            var fileName = Guid.NewGuid().ToString() + Path.GetExtension(file.FileName);
            var filePath = Path.Combine(uploadsFolder, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await file.CopyToAsync(stream);
            }

            var imageUrl = $"{scheme}://{host}/uploads/arena/{fileName}";
            arena.ImageUrl = imageUrl;
            await _arenaRepository.UpdateArenaAsync(arena);

            return ServiceResult.Ok(new { imageUrl });
        }

        private static ArenaDto MapArena(Arena arena)
        {
            return new ArenaDto
            {
                Id = arena.Id,
                Name = arena.Name,
                Description = arena.Description,
                City = arena.CityRef.Name,
                CityId = arena.CityId,
                SportType = arena.SportType,
                Address = arena.Address,
                ImageUrl = arena.ImageUrl,
                PricePerHour = arena.PricePerHour,
                CreatedAt = arena.CreatedAt
            };
        }
    }
}
