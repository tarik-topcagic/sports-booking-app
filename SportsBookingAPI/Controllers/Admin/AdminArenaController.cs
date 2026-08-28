using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SportsBookingAPI.DTOs.Admin;
using SportsBookingAPI.Interfaces;

namespace SportsBookingAPI.Controllers.Admin
{
    [Route("api/admin/arenas")]
    [ApiController]
    [Authorize(Policy = "RequireAdminRole")]
    public class AdminArenaController : ControllerBase
    {
        private readonly IArenaService _arenaService;

        public AdminArenaController(IArenaService arenaService)
        {
            _arenaService = arenaService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAllArenas(
            [FromQuery] string? name,
            [FromQuery] string? city,
            [FromQuery] string? sportType)
        {
            var arenas = await _arenaService.GetAllArenasForAdminAsync(name, city, sportType);
            return Ok(arenas);
        }

        [HttpGet("filter-options")]
        public async Task<IActionResult> GetFilterOptions()
        {
            var (cities, sports) = await _arenaService.GetArenaFilterOptionsAsync();
            return Ok(new { cities, sports });
        }

        [HttpPost]
        public async Task<IActionResult> CreateArena([FromBody] CreateArenaDto createArenaDto)
        {
            var result = await _arenaService.CreateArenaAsync(createArenaDto);
            return StatusCode(result.StatusCode, result.Payload);
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateArena(int id, [FromBody] UpdateArenaDto updateArenaDto)
        {
            var result = await _arenaService.UpdateArenaAsync(id, updateArenaDto);
            return StatusCode(result.StatusCode, result.Payload);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteArena(int id)
        {
            var result = await _arenaService.DeleteArenaAsync(id);
            return StatusCode(result.StatusCode, result.Payload);
        }

        [HttpPost("{id}/upload-picture")]
        [Consumes("multipart/form-data")]
        public async Task<IActionResult> UploadArenaPicture(int id, IFormFile file)
        {
            var result = await _arenaService.UploadArenaPictureAsync(id, file, Request.Scheme, Request.Host);
            return StatusCode(result.StatusCode, result.Payload);
        }
    }
}
