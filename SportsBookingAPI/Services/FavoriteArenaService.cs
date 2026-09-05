using SportsBookingAPI.DTOs;
using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Services
{
    public class FavoriteArenaService : IFavoriteArenaService
    {
        private readonly IFavoriteArenaRepository _favoriteArenaRepository;
        private readonly IArenaRepository _arenaRepository;

        public FavoriteArenaService(IFavoriteArenaRepository favoriteArenaRepository, IArenaRepository arenaRepository)
        {
            _favoriteArenaRepository = favoriteArenaRepository;
            _arenaRepository = arenaRepository;
        }

        public async Task<ServiceResult> AddFavoriteAsync(string userId, int arenaId)
        {
            var arena = await _arenaRepository.GetArenaByIdAsync(arenaId);
            if (arena == null)
                return ServiceResult.NotFound("Arena not found");

            var existing = await _favoriteArenaRepository.GetAsync(userId, arenaId);
            if (existing != null)
                return ServiceResult.BadRequest("Arena is already in favorites");

            var favoriteArena = new FavoriteArena
            {
                UserId = userId,
                ArenaId = arenaId,
                CreatedAt = DateTime.UtcNow
            };

            await _favoriteArenaRepository.AddAsync(favoriteArena);

            return ServiceResult.Ok(ToDto(favoriteArena, arena));
        }

        public async Task<ServiceResult> RemoveFavoriteAsync(string userId, int arenaId)
        {
            var existing = await _favoriteArenaRepository.GetAsync(userId, arenaId);
            if (existing == null)
                return ServiceResult.NotFound("Favorite not found");

            await _favoriteArenaRepository.RemoveAsync(existing.Id);

            return ServiceResult.Ok(new { message = "Removed from favorites" });
        }

        public async Task<ServiceResult> GetMyFavoritesAsync(string userId)
        {
            var favorites = await _favoriteArenaRepository.GetForUserAsync(userId);
            return ServiceResult.Ok(favorites.Select(f => ToDto(f, f.Arena)));
        }

        private static FavoriteArenaDto ToDto(FavoriteArena favoriteArena, Arena arena)
        {
            return new FavoriteArenaDto
            {
                Id = favoriteArena.Id,
                ArenaId = arena.Id,
                ArenaName = arena.Name,
                City = arena.CityRef.Name,
                SportType = arena.SportType,
                ImageUrl = arena.ImageUrl,
                PricePerHour = arena.PricePerHour,
                CreatedAt = favoriteArena.CreatedAt
            };
        }
    }
}
