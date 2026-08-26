using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SportsBookingAPI.Interfaces;
using System.Security.Claims;

namespace SportsBookingAPI.Controllers
{
    [Route("api/users")]
    [Authorize]
    [ApiController]
    public class UserController : ControllerBase
    {
        private readonly IUserService _userService;

        public UserController(IUserService userService)
        {
            _userService = userService;
        }

        [HttpGet("my-profile")]
        public async Task<IActionResult> GetMyProfile()
        {
            var userId = User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null)
                return Unauthorized();

            var user = await _userService.GetMyProfileAsync(userId);
            if (user == null)
                return NotFound();

            return Ok(user);
        }

        [HttpGet("{username}")]
        public async Task<IActionResult> GetUserProfileByUsername(string username)
        {
            var result = await _userService.GetUserProfileByUsernameAsync(username);

            if (result.Profile != null)
                return Ok(result.Profile);

            if (result.RedirectUsername != null)
                return NotFound(new { message = "User not found", redirectUsername = result.RedirectUsername });

            return NotFound(new { message = "User not found" });
        }

        [HttpGet("get-users")]
        public async Task<IActionResult> SearchUsers([FromQuery] string? query)
        {
            var currentUserId = User?.FindFirstValue(ClaimTypes.NameIdentifier);
            var users = await _userService.SearchUsersAsync(query, currentUserId);

            return Ok(users);
        }
    }
}
