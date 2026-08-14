using Microsoft.AspNetCore.Mvc;
using SportsBookingAPI.Interfaces;

namespace SportsBookingAPI.Controllers
{
    [Route("api/cities")]
    [ApiController]
    public class CityController : ControllerBase
    {
        private readonly ICityService _cityService;

        public CityController(ICityService cityService)
        {
            _cityService = cityService;
        }

        [HttpGet("get-cities")]
        public async Task<IActionResult> GetCities()
        {
            var cities = await _cityService.GetAllCitiesAsync();
            return Ok(cities);
        }
    }
}
