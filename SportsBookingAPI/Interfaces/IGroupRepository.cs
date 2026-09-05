using SportsBookingAPI.DTOs;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Interfaces
{
    public interface IGroupRepository
    {
        Task<Group> CreateGroupAsync(Group group);
        Task<IEnumerable<Group>> GetAllGroupsAsync(string? name, string? owner);
        Task<Group> UpdateGroupAsync(Group group);
        Task DeleteGroupAsync(int groupId);
        Task<Group?> GetGroupByIdAsync(int groupId);
        Task<IEnumerable<Group>> GetGroupsByAdminAsync(string adminId);
        Task AddMembershipAsync(GroupMembership membership);
        Task<GroupMembership?> GetMembershipByIdAsync(int membershipId);
        Task<GroupMembership?> GetMembershipAsync(int groupId, string userId);
        Task<IEnumerable<GroupMembership>> GetMembershipsForGroupAsync(int groupId);
        Task<IEnumerable<GroupMembership>> GetMembershipsForUserAsync(string userId);
        Task<bool> ShareAcceptedGroupAsync(string firstUserId, string secondUserId);
        Task<IReadOnlyList<string>> GetPresenceViewerUserIdsAsync(string userId);
        Task RemoveMembershipAsync(int membershipId);
        Task UpdateMembershipAsync(GroupMembership membership);
        Task<IEnumerable<Group>> GetMemberGroupsAsync(string userId);
        Task<IEnumerable<Group>> GetPendingJoinRequestGroupsAsync(string userId);
        Task<IEnumerable<Group>> GetPendingInvitationGroupsAsync(string userId);
        Task<IEnumerable<Group>> SearchGroupsAsync(string query);
        Task<IEnumerable<Group>> GetPublicGroupsAsync(string userId);
        Task<bool> CityHasGroupsAsync(int cityId);
    }
}
