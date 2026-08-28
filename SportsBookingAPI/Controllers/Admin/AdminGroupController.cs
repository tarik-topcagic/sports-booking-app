using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SportsBookingAPI.DTOs;
using SportsBookingAPI.Interfaces;

namespace SportsBookingAPI.Controllers.Admin
{
    [Route("api/admin/groups")]
    [ApiController]
    [Authorize(Policy = "RequireAdminRole")]
    public class AdminGroupController : ControllerBase
    {
        private readonly IGroupService _groupService;

        public AdminGroupController(IGroupService groupService)
        {
            _groupService = groupService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAllGroups(
            [FromQuery] string? name,
            [FromQuery] string? owner)
        {
            var groups = await _groupService.GetAllGroupsForAdminAsync(name, owner);
            return Ok(groups);
        }

        [HttpPut("{groupId}")]
        public async Task<IActionResult> UpdateGroup(int groupId, [FromBody] UpdateGroupDto updateGroupDto)
        {
            var result = await _groupService.AdminUpdateGroupAsync(groupId, updateGroupDto);
            return StatusCode(result.StatusCode, result.Payload);
        }

        [HttpDelete("{groupId}")]
        public async Task<IActionResult> DeleteGroup(int groupId)
        {
            var result = await _groupService.AdminDeleteGroupAsync(groupId);
            return StatusCode(result.StatusCode, result.Payload);
        }
    }
}
