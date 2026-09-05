using SportsBookingAPI.DTOs;
using SportsBookingAPI.Helpers;
using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Services
{
    public class GroupService : IGroupService
    {
        private readonly IGroupRepository _groupRepository;
        private readonly ICityRepository _cityRepository;
        private readonly ILogger<GroupService> _logger;

        public GroupService(IGroupRepository groupRepository, ICityRepository cityRepository, ILogger<GroupService> logger)
        {
            _groupRepository = groupRepository;
            _cityRepository = cityRepository;
            _logger = logger;
        }

        public async Task<ServiceResult> CreateGroupAsync(string userId, CreateGroupDto groupDto)
        {
            var city = await _cityRepository.GetCityByIdAsync(groupDto.CityId);
            if (city == null)
                return ServiceResult.BadRequest("Selected city was not found.");

            var group = new Group
            {
                Name = groupDto.Name,
                Description = groupDto.Description,
                CityId = city.Id,
                CityRef = city,
                SportCategory = groupDto.SportCategory,
                AdminId = userId,
                DateCreated = DateTime.UtcNow,
                ImageUrl = groupDto.ImageUrl ?? "default-group.png"
            };

            var createdGroup = await _groupRepository.CreateGroupAsync(group);

            var membership = new GroupMembership
            {
                GroupId = createdGroup.Id,
                UserId = userId,
                Status = MembershipStatus.Accepted,
                CreatedAt = DateTime.UtcNow,
                JoinedAt = DateTime.UtcNow,
                RespondedAt = DateTime.UtcNow
            };

            await _groupRepository.AddMembershipAsync(membership);

            return ServiceResult.Ok(GroupMappingHelper.ToGroupDto(createdGroup));
        }

        public async Task<ServiceResult> UpdateGroupAsync(string userId, int groupId, UpdateGroupDto updateGroupDto)
        {
            var group = await _groupRepository.GetGroupByIdAsync(groupId);
            if (group == null)
                return ServiceResult.NotFound("Group not found");

            if (group.AdminId != userId)
                return ServiceResult.Forbid("Only admin can update the group");

            var city = await _cityRepository.GetCityByIdAsync(updateGroupDto.CityId);
            if (city == null)
                return ServiceResult.BadRequest("Selected city was not found.");

            group.Name = updateGroupDto.Name;
            group.Description = updateGroupDto.Description;
            group.CityId = city.Id;
            group.CityRef = city;
            group.SportCategory = updateGroupDto.SportCategory;
            group.ImageUrl = updateGroupDto.GroupPictureUrl ?? "default-group.png";

            var updatedGroup = await _groupRepository.UpdateGroupAsync(group);
            return ServiceResult.Ok(GroupMappingHelper.ToGroupDto(updatedGroup));
        }

        public async Task<ServiceResult> DeleteGroupAsync(string userId, int groupId)
        {
            try
            {
                var group = await _groupRepository.GetGroupByIdAsync(groupId);
                if (group == null)
                    return ServiceResult.NotFound("Group not found");

                if (group.AdminId != userId)
                    return ServiceResult.Forbid("Only admin can delete the group");

                await _groupRepository.DeleteGroupAsync(groupId);
                return ServiceResult.Ok(new { message = "Group deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Error in GroupService.DeleteGroupAsync for group {GroupId} and user {UserId}. Message: {Message}. InnerException: {InnerException}. StackTrace: {StackTrace}",
                    groupId,
                    userId,
                    ex.Message,
                    ex.InnerException?.ToString(),
                    ex.StackTrace
                );

                throw;
            }
        }

        public async Task<GroupDetailsDto?> GetGroupDetailsAsync(string userId, int groupId)
        {
            var group = await _groupRepository.GetGroupByIdAsync(groupId);
            return group == null ? null : GroupMappingHelper.ToGroupDetailsDto(group, userId);
        }

        public async Task<IEnumerable<GroupDto>> GetAdminGroupsAsync(string userId)
        {
            var groups = await _groupRepository.GetGroupsByAdminAsync(userId);
            return groups.Select(GroupMappingHelper.ToGroupDto);
        }

        public async Task<IEnumerable<GroupDto>> GetMemberGroupsAsync(string userId)
        {
            var groups = await _groupRepository.GetMemberGroupsAsync(userId);
            return groups.Select(GroupMappingHelper.ToGroupDto);
        }

        public async Task<IEnumerable<GroupDto>> GetPendingJoinRequestGroupsAsync(string userId)
        {
            var groups = await _groupRepository.GetPendingJoinRequestGroupsAsync(userId);
            return groups.Select(GroupMappingHelper.ToGroupDto);
        }

        public async Task<IEnumerable<GroupDto>> GetPendingInvitationGroupsAsync(string userId)
        {
            var groups = await _groupRepository.GetPendingInvitationGroupsAsync(userId);
            return groups.Select(GroupMappingHelper.ToGroupDto);
        }

        public async Task<IEnumerable<GroupDto>> SearchGroupsAsync(string userId, string? query)
        {
            var groups = string.IsNullOrWhiteSpace(query)
                ? await _groupRepository.GetPublicGroupsAsync(userId)
                : await _groupRepository.SearchGroupsAsync(query);

            return groups.Select(GroupMappingHelper.ToGroupDto);
        }

        public async Task<IEnumerable<GroupDto>> GetAllGroupsForAdminAsync(string? name, string? owner)
        {
            var groups = await _groupRepository.GetAllGroupsAsync(name, owner);
            return groups.Select(GroupMappingHelper.ToGroupDto);
        }

        public async Task<ServiceResult> AdminUpdateGroupAsync(int groupId, UpdateGroupDto updateGroupDto)
        {
            var group = await _groupRepository.GetGroupByIdAsync(groupId);
            if (group == null)
                return ServiceResult.NotFound("Group not found");

            var city = await _cityRepository.GetCityByIdAsync(updateGroupDto.CityId);
            if (city == null)
                return ServiceResult.BadRequest("Selected city was not found.");

            group.Name = updateGroupDto.Name;
            group.Description = updateGroupDto.Description;
            group.CityId = city.Id;
            group.CityRef = city;
            group.SportCategory = updateGroupDto.SportCategory;
            group.ImageUrl = updateGroupDto.GroupPictureUrl ?? "default-group.png";

            var updatedGroup = await _groupRepository.UpdateGroupAsync(group);
            return ServiceResult.Ok(GroupMappingHelper.ToGroupDto(updatedGroup));
        }

        public async Task<ServiceResult> AdminDeleteGroupAsync(int groupId)
        {
            try
            {
                var group = await _groupRepository.GetGroupByIdAsync(groupId);
                if (group == null)
                    return ServiceResult.NotFound("Group not found");

                await _groupRepository.DeleteGroupAsync(groupId);
                return ServiceResult.Ok(new { message = "Group deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Error in GroupService.AdminDeleteGroupAsync for group {GroupId}. Message: {Message}. InnerException: {InnerException}. StackTrace: {StackTrace}",
                    groupId,
                    ex.Message,
                    ex.InnerException?.ToString(),
                    ex.StackTrace
                );

                return ServiceResult.BadRequest("Cannot delete this group due to an unexpected error. Please try again or contact support.");
            }
        }
    }
}
