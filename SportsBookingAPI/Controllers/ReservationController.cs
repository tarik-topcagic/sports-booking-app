using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SportsBookingAPI.DTOs;
using SportsBookingAPI.Interfaces;
using System.Security.Claims;

namespace SportsBookingAPI.Controllers
{
    [Route("api/reservations")]
    [ApiController]
    [Authorize]
    public class ReservationController : ControllerBase
    {
        private readonly IReservationService _reservationService;

        public ReservationController(IReservationService reservationService)
        {
            _reservationService = reservationService;
        }

        [HttpPost]
        public async Task<IActionResult> CreateReservation([FromBody] CreateReservationDto createReservationDto)
        {
            var userId = User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null)
                return Unauthorized();

            var result = await _reservationService.CreateReservationAsync(userId, createReservationDto);
            return StatusCode(result.StatusCode, result.Payload);
        }

        [HttpDelete("{id}/cancel")]
        public async Task<IActionResult> CancelReservation(int id)
        {
            var userId = User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null)
                return Unauthorized();

            var result = await _reservationService.CancelReservationAsync(userId, id);
            return StatusCode(result.StatusCode, result.Payload);
        }

        [HttpGet("mine")]
        public async Task<IActionResult> GetMyReservations()
        {
            var userId = User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null)
                return Unauthorized();

            var result = await _reservationService.GetMyReservationsAsync(userId);
            return StatusCode(result.StatusCode, result.Payload);
        }
    }
}
