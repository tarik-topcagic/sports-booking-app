using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using SportsBookingAPI.DTOs;
using SportsBookingAPI.Interfaces;
using System.Security.Claims;

namespace SportsBookingAPI.Controllers
{
    [Route("api/groups")]
    [ApiController]
    [Authorize]
    public class GroupController : ControllerBase
    {
        private readonly IGroupService _groupService;
        private readonly ILogger<GroupController> _logger;

        public GroupController(IGroupService groupService, ILogger<GroupController> logger)
        {
            _groupService = groupService;
            _logger = logger;
        }

        [HttpPost("create")]
        public async Task<IActionResult> CreateGroup([FromBody] CreateGroupDto groupDto)
        {
            var userId = User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null)
                return Unauthorized();

            var result = await _groupService.CreateGroupAsync(userId, groupDto);
            return StatusCode(result.StatusCode, result.Payload);
        }

        [HttpPut("{groupId}/update")]
        public async Task<IActionResult> UpdateGroup(int groupId, [FromBody] UpdateGroupDto updateGroupDto)
        {
            var userId = User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null)
                return Unauthorized();

            var result = await _groupService.UpdateGroupAsync(userId, groupId, updateGroupDto);
            return StatusCode(result.StatusCode, result.Payload);
        }

        [HttpDelete("{groupId:int}")]
        public async Task<IActionResult> DeleteGroup(int groupId)
        {
            var userId = User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null)
                return Unauthorized();

            try
            {
                var result = await _groupService.DeleteGroupAsync(userId, groupId);
                return StatusCode(result.StatusCode, result.Payload);
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Unhandled exception while deleting group {GroupId} for user {UserId}. Message: {Message}. InnerException: {InnerException}. StackTrace: {StackTrace}",
                    groupId,
                    userId,
                    ex.Message,
                    ex.InnerException?.ToString(),
                    ex.StackTrace
                );

                return StatusCode(500, "An error occurred while deleting the group.");
            }
        }

        [HttpGet("{groupId:int}")]
        public async Task<IActionResult> GetGroupDetails(int groupId)
        {
            var userId = User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null)
                return Unauthorized();

            var group = await _groupService.GetGroupDetailsAsync(userId, groupId);
            if (group == null)
                return NotFound("Group not found");

            return Ok(group);
        }

        [HttpGet("admin")]
        public async Task<IActionResult> GetMyGroups()
        {
            var userId = User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null)
                return Unauthorized();

            var groups = await _groupService.GetAdminGroupsAsync(userId);
            return Ok(groups);
        }

        [HttpGet("membership")]
        public async Task<IActionResult> GetMemberGroups()
        {
            var userId = User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null)
                return Unauthorized();

            var groups = await _groupService.GetMemberGroupsAsync(userId);
            return Ok(groups);
        }

        [HttpGet("pending-requests")]
        public async Task<IActionResult> GetPendingJoinRequestGroups()
        {
            var userId = User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null)
                return Unauthorized();

            var groups = await _groupService.GetPendingJoinRequestGroupsAsync(userId);
            return Ok(groups);
        }

        [HttpGet("pending-invitations")]
        public async Task<IActionResult> GetPendingInvitationGroups()
        {
            var userId = User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null)
                return Unauthorized();

            var groups = await _groupService.GetPendingInvitationGroupsAsync(userId);
            return Ok(groups);
        }

        [HttpGet("search-groups")]
        public async Task<IActionResult> SearchGroups([FromQuery] string? query)
        {
            var userId = User?.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null)
                return Unauthorized();

            var groups = await _groupService.SearchGroupsAsync(userId, query);
            return Ok(groups);
        }
    }
}
