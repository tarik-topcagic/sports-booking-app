using Microsoft.AspNetCore.Mvc;
using SportsBookingAPI.Interfaces;

namespace SportsBookingAPI.Controllers
{
    [Route("api/cantons")]
    [ApiController]
    public class CantonController : ControllerBase
    {
        private readonly ICantonService _cantonService;

        public CantonController(ICantonService cantonService)
        {
            _cantonService = cantonService;
        }

        [HttpGet("get-cantons")]
        public async Task<IActionResult> GetCantons()
        {
            var cantons = await _cantonService.GetAllCantonsAsync();
            return Ok(cantons);
        }
    }
}
