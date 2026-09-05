using Microsoft.AspNetCore.Mvc;
using SportsBookingAPI.Interfaces;

namespace SportsBookingAPI.Controllers
{
    [Route("api/arenas")]
    [ApiController]
    public class ArenaController : ControllerBase
    {
        private readonly IArenaService _arenaService;

        public ArenaController(IArenaService arenaService)
        {
            _arenaService = arenaService;
        }

        [HttpGet]
        public async Task<IActionResult> GetArenas([FromQuery] string? city, [FromQuery] string? sportType, [FromQuery] string? searchTerm)
        {
            var arenas = await _arenaService.GetArenasAsync(city, sportType, searchTerm);
            return Ok(arenas);
        }

        [HttpGet("{id:int}")]
        public async Task<IActionResult> GetArenaById(int id)
        {
            var arena = await _arenaService.GetArenaByIdAsync(id);
            if (arena == null)
                return NotFound();

            return Ok(arena);
        }

        [HttpGet("{id:int}/availability")]
        public async Task<IActionResult> GetAvailability(int id, [FromQuery] DateTime date)
        {
            var availability = await _arenaService.GetAvailabilityAsync(id, date);
            if (availability == null)
                return NotFound();

            return Ok(availability);
        }

        [HttpGet("filter-options")]
        public async Task<IActionResult> GetFilterOptions()
        {
            var (cities, sports) = await _arenaService.GetArenaFilterOptionsAsync();
            return Ok(new { cities, sports });
        }
    }
}
