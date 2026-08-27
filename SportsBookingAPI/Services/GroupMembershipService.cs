using SportsBookingAPI.DTOs;
using SportsBookingAPI.Helpers;
using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Services
{
    public class GroupMembershipService : IGroupMembershipService
    {
        private readonly IGroupRepository _groupRepository;
        private readonly IUserRepository _userRepository;
        private readonly IGroupNotificationService _groupNotificationService;

        public GroupMembershipService(
            IGroupRepository groupRepository,
            IUserRepository userRepository,
            IGroupNotificationService groupNotificationService)
        {
            _groupRepository = groupRepository;
            _userRepository = userRepository;
            _groupNotificationService = groupNotificationService;
        }

        public async Task<ServiceResult> RequestToJoinAsync(string userId, int groupId)
        {
            var group = await _groupRepository.GetGroupByIdAsync(groupId);
            if (group == null)
                return ServiceResult.NotFound("Group not found");

            if (group.AdminId == userId)
                return ServiceResult.BadRequest("Group admin is already a member");

            var membership = group.Memberships.FirstOrDefault(m => m.UserId == userId);
            if (membership != null && membership.Status != MembershipStatus.Declined)
                return ServiceResult.BadRequest("You already have an active membership, invitation, or join request");

            if (membership == null)
            {
                membership = new GroupMembership
                {
                    GroupId = groupId,
                    UserId = userId,
                    Status = MembershipStatus.PendingJoinRequest,
                    CreatedAt = DateTime.UtcNow,
                    RespondedAt = null
                };

                await _groupRepository.AddMembershipAsync(membership);
            }
            else
            {
                membership.Status = MembershipStatus.PendingJoinRequest;
                membership.CreatedAt = DateTime.UtcNow;
                membership.RespondedAt = null;

                await _groupRepository.UpdateMembershipAsync(membership);
            }

            await _groupNotificationService.CreateGroupJoinRequestNotificationAsync(group.AdminId, userId, groupId, membership.Id);

            return ServiceResult.Ok(new { message = "Join request sent." });
        }

        public async Task<ServiceResult> InviteMemberAsync(string adminId, int groupId, InviteMemberDto inviteMemberDto)
        {
            var group = await _groupRepository.GetGroupByIdAsync(groupId);
            if (group == null)
                return ServiceResult.NotFound("Group not found");

            if (group.AdminId != adminId)
                return ServiceResult.Forbid("Only admin can send invitations");

            var invitedUser = await _userRepository.GetUserByIdAsync(inviteMemberDto.UserId);
            if (invitedUser == null)
                return ServiceResult.NotFound("User not found");

            if (inviteMemberDto.UserId == adminId)
                return ServiceResult.BadRequest("Group admin is already a member");

            var membership = group.Memberships.FirstOrDefault(m => m.UserId == inviteMemberDto.UserId);
            if (membership != null && membership.Status != MembershipStatus.Declined)
                return ServiceResult.BadRequest("User already has an active membership, invitation, or join request");

            if (membership == null)
            {
                membership = new GroupMembership
                {
                    GroupId = groupId,
                    UserId = inviteMemberDto.UserId,
                    Status = MembershipStatus.PendingInvitation,
                    CreatedAt = DateTime.UtcNow,
                    RespondedAt = null
                };

                await _groupRepository.AddMembershipAsync(membership);
            }
            else
            {
                membership.Status = MembershipStatus.PendingInvitation;
                membership.CreatedAt = DateTime.UtcNow;
                membership.RespondedAt = null;

                await _groupRepository.UpdateMembershipAsync(membership);
            }

            await _groupNotificationService.CreateGroupInvitationNotificationAsync(inviteMemberDto.UserId, adminId, groupId, membership.Id);

            return ServiceResult.Ok(new { message = "Invitation sent" });
        }

        public async Task<ServiceResult> CancelInvitationAsync(string adminId, int groupId, string userId)
        {
            var group = await _groupRepository.GetGroupByIdAsync(groupId);
            if (group == null)
                return ServiceResult.NotFound("Group not found");

            if (group.AdminId != adminId)
                return ServiceResult.Forbid("Only admin can cancel invitations");

            var membership = group.Memberships.FirstOrDefault(m => m.UserId == userId && m.Status == MembershipStatus.PendingInvitation);
            if (membership == null)
                return ServiceResult.NotFound("Pending invitation not found");

            await _groupNotificationService.DeleteGroupInvitationNotificationsAsync(groupId, userId, membership.Id);
            await _groupRepository.RemoveMembershipAsync(membership.Id);

            return ServiceResult.Ok(new { message = "Invitation cancelled" });
        }

        public async Task<ServiceResult> RespondInviteAsync(string userId, RespondInviteDto respondInviteDto)
        {
            var membership = await _groupRepository.GetMembershipByIdAsync(respondInviteDto.MembershipId);
            if (membership == null || membership.UserId != userId || membership.Status != MembershipStatus.PendingInvitation)
                return ServiceResult.NotFound("Pending invitation not found");

            if (respondInviteDto.Accept)
            {
                membership.Status = MembershipStatus.Accepted;
                membership.JoinedAt = DateTime.UtcNow;
                membership.RespondedAt = DateTime.UtcNow;
                await _groupRepository.UpdateMembershipAsync(membership);
                await _groupNotificationService.MarkInvitationNotificationsAsReadAsync(membership.Id, userId);

                if (!string.IsNullOrWhiteSpace(membership.group?.AdminId))
                {
                    await _groupNotificationService.CreateGroupInvitationAcceptedNotificationAsync(
                        membership.group.AdminId,
                        userId,
                        membership.GroupId,
                        membership.Id);
                }

                return ServiceResult.Ok(new { message = "Invitation accepted" });
            }

            membership.Status = MembershipStatus.Declined;
            membership.RespondedAt = DateTime.UtcNow;
            await _groupRepository.UpdateMembershipAsync(membership);
            await _groupNotificationService.DeleteGroupInvitationNotificationsAsync(membership.GroupId, userId, membership.Id);

            return ServiceResult.Ok(new { message = "Invitation declined" });
        }

        public async Task<ServiceResult> RemoveMemberAsync(string userId, int groupId, string memberId)
        {
            var group = await _groupRepository.GetGroupByIdAsync(groupId);
            if (group == null)
                return ServiceResult.NotFound("Group not found");

            if (memberId == group.AdminId)
                return ServiceResult.BadRequest("Group admin cannot be removed from the group");

            if (memberId != userId && group.AdminId != userId)
                return ServiceResult.Forbid("Only admin can remove other members");

            var membership = group.Memberships.FirstOrDefault(m => m.UserId == memberId && m.Status == MembershipStatus.Accepted);
            if (membership == null)
                return ServiceResult.NotFound("Membership not found");

            await _groupRepository.RemoveMembershipAsync(membership.Id);

            return ServiceResult.Ok(new { message = "Member removed" });
        }

        public async Task<ServiceResult> CancelJoinRequestAsync(string userId, int groupId)
        {
            var group = await _groupRepository.GetGroupByIdAsync(groupId);
            if (group == null)
                return ServiceResult.NotFound("Group not found");

            var membership = group.Memberships.FirstOrDefault(m => m.UserId == userId && m.Status == MembershipStatus.PendingJoinRequest);
            if (membership == null)
                return ServiceResult.NotFound("Pending join request not found");

            await _groupNotificationService.DeleteGroupJoinRequestNotificationsAsync(groupId, group.AdminId, userId, membership.Id);
            await _groupRepository.RemoveMembershipAsync(membership.Id);

            return ServiceResult.Ok(new { message = "Join request cancelled" });
        }

        public async Task<ServiceResult> RespondJoinRequestAsync(string adminId, int groupId, RespondJoinRequestDto respondJoinRequestDto)
        {
            var group = await _groupRepository.GetGroupByIdAsync(groupId);
            if (group == null)
                return ServiceResult.NotFound("Group not found");

            if (group.AdminId != adminId)
                return ServiceResult.Forbid("Only admin can respond to join requests");

            var membership = group.Memberships.FirstOrDefault(m => m.Id == respondJoinRequestDto.MembershipId && m.Status == MembershipStatus.PendingJoinRequest);
            if (membership == null)
                return ServiceResult.NotFound("Join request not found");

            if (respondJoinRequestDto.Accept)
            {
                membership.Status = MembershipStatus.Accepted;
                membership.JoinedAt = DateTime.UtcNow;
                membership.RespondedAt = DateTime.UtcNow;
                await _groupRepository.UpdateMembershipAsync(membership);

                await _groupNotificationService.CreateGroupJoinRequestAcceptedNotificationAsync(
                    membership.UserId,
                    adminId,
                    groupId,
                    membership.Id);

                return ServiceResult.Ok(new { message = "Join request accepted" });
            }

            membership.Status = MembershipStatus.Declined;
            membership.RespondedAt = DateTime.UtcNow;
            await _groupRepository.UpdateMembershipAsync(membership);
            await _groupNotificationService.DeleteGroupJoinRequestNotificationsAsync(groupId, adminId, membership.UserId, membership.Id);

            return ServiceResult.Ok(new { message = "Join request declined" });
        }

        public async Task<ServiceResult> GetMembershipStatusForAdminGroupsAsync(string adminId, string targetUserId)
        {
            var targetUser = await _userRepository.GetUserByIdAsync(targetUserId);
            if (targetUser == null)
                return ServiceResult.NotFound("User not found");

            var groups = await _groupRepository.GetGroupsByAdminAsync(adminId);
            var statuses = groups
                .SelectMany(group => group.Memberships
                    .Where(membership => membership.UserId == targetUserId)
                    .Select(membership => new GroupMembershipStateDto
                    {
                        GroupId = group.Id,
                        UserId = membership.UserId,
                        MembershipId = membership.Id,
                        Status = membership.Status
                    }));

            return ServiceResult.Ok(statuses);
        }

        public async Task<ServiceResult> GetPendingJoinRequestsAsync(string adminId, int groupId)
        {
            var group = await _groupRepository.GetGroupByIdAsync(groupId);
            if (group == null)
                return ServiceResult.NotFound("Group not found");

            if (group.AdminId != adminId)
                return ServiceResult.Forbid("Only admin can view join requests");

            var requests = group.Memberships
                .Where(m => m.Status == MembershipStatus.PendingJoinRequest)
                .Select(GroupMappingHelper.ToMembershipDto);

            return ServiceResult.Ok(requests);
        }

        public async Task<ServiceResult> GetGroupMembershipsAsync(string adminId, int groupId)
        {
            var group = await _groupRepository.GetGroupByIdAsync(groupId);
            if (group == null)
                return ServiceResult.NotFound("Group not found");

            if (group.AdminId != adminId)
                return ServiceResult.Forbid("Only admin can view group memberships");

            var memberships = group.Memberships.Select(GroupMappingHelper.ToMembershipDto);

            return ServiceResult.Ok(memberships);
        }

        public async Task<ServiceResult> GetMyPendingInvitationsAsync(string userId)
        {
            var invitations = (await _groupRepository.GetMembershipsForUserAsync(userId))
                .Where(m => m.Status == MembershipStatus.PendingInvitation)
                .Select(GroupMappingHelper.ToMembershipDto);

            return ServiceResult.Ok(invitations);
        }

        public async Task<ServiceResult> AdminRemoveMemberAsync(int groupId, string memberId)
        {
            var group = await _groupRepository.GetGroupByIdAsync(groupId);
            if (group == null)
                return ServiceResult.NotFound("Group not found");

            if (memberId == group.AdminId)
                return ServiceResult.BadRequest("Group admin cannot be removed from the group");

            var membership = group.Memberships.FirstOrDefault(m => m.UserId == memberId && m.Status == MembershipStatus.Accepted);
            if (membership == null)
                return ServiceResult.NotFound("Membership not found");

            await _groupRepository.RemoveMembershipAsync(membership.Id);

            return ServiceResult.Ok(new { message = "Member removed" });
        }
    }
}
