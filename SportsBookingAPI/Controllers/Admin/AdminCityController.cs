using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SportsBookingAPI.DTOs.Admin;
using SportsBookingAPI.Interfaces;

namespace SportsBookingAPI.Controllers.Admin
{
    [Route("api/admin/cities")]
    [ApiController]
    [Authorize(Policy = "RequireAdminRole")]
    public class AdminCityController : ControllerBase
    {
        private readonly ICityService _cityService;

        public AdminCityController(ICityService cityService)
        {
            _cityService = cityService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAllCities()
        {
            var cities = await _cityService.GetAllCitiesAsync();
            return Ok(cities);
        }

        [HttpPost]
        public async Task<IActionResult> CreateCity([FromBody] CreateCityDto createCityDto)
        {
            var result = await _cityService.CreateCityAsync(createCityDto);
            return StatusCode(result.StatusCode, result.Payload);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCity(int id)
        {
            var result = await _cityService.DeleteCityAsync(id);
            return StatusCode(result.StatusCode, result.Payload);
        }
    }
}
