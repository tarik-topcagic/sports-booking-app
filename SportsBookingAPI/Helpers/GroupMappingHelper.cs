using SportsBookingAPI.DTOs;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Helpers
{
    public static class GroupMappingHelper
    {
        public static GroupDto ToGroupDto(Group group)
        {
            return new GroupDto
            {
                Id = group.Id,
                Name = group.Name,
                Description = group.Description,
                City = group.CityRef.Name,
                CityId = group.CityId,
                SportCategory = group.SportCategory,
                AdminId = group.AdminId,
                AdminDisplayName = !string.IsNullOrWhiteSpace(group.Admin?.FullName)
                    ? group.Admin.FullName
                    : group.Admin?.UserName ?? string.Empty,
                AdminUsername = group.Admin?.UserName ?? string.Empty,
                DateCreated = group.DateCreated,
                ImageUrl = group.ImageUrl,
                MembersCount = GetVisibleMembersCount(group)
            };
        }

        public static GroupDetailsDto ToGroupDetailsDto(Group group, string currentUserId)
        {
            var memberships = group.Memberships ?? new List<GroupMembership>();
            var acceptedMembersCount = memberships.Count(m => m.Status == MembershipStatus.Accepted);
            var adminHasAcceptedMembership = memberships.Any(m => m.UserId == group.AdminId && m.Status == MembershipStatus.Accepted);
            var isAdmin = group.AdminId == currentUserId;
            var isAcceptedMember = memberships.Any(m => m.UserId == currentUserId && m.Status == MembershipStatus.Accepted);
            var pendingInvitation = memberships.FirstOrDefault(m => m.UserId == currentUserId && m.Status == MembershipStatus.PendingInvitation);
            var acceptedMembers = memberships
                .Where(m => m.Status == MembershipStatus.Accepted && m.User != null)
                .Select(m => new GroupMemberDto
                {
                    UserId = m.UserId,
                    Username = m.User?.UserName ?? string.Empty,
                    DisplayName = !string.IsNullOrWhiteSpace(m.User?.FullName)
                        ? m.User.FullName
                        : m.User?.UserName ?? string.Empty,
                    ProfilePictureUrl = m.User?.ProfilePictureUrl ?? "default-profile.png",
                    IsAdmin = m.UserId == group.AdminId
                })
                .ToList();

            if (!acceptedMembers.Any(m => m.UserId == group.AdminId) && group.Admin != null)
            {
                acceptedMembers.Add(new GroupMemberDto
                {
                    UserId = group.AdminId,
                    Username = group.Admin.UserName ?? string.Empty,
                    DisplayName = !string.IsNullOrWhiteSpace(group.Admin.FullName)
                        ? group.Admin.FullName
                        : group.Admin.UserName ?? string.Empty,
                    ProfilePictureUrl = group.Admin.ProfilePictureUrl,
                    IsAdmin = true
                });
            }

            acceptedMembers = acceptedMembers
                .OrderByDescending(member => member.IsAdmin)
                .ThenBy(member => member.DisplayName)
                .ToList();

            return new GroupDetailsDto
            {
                Id = group.Id,
                Name = group.Name,
                Description = group.Description,
                City = group.CityRef.Name,
                CityId = group.CityId,
                SportCategory = group.SportCategory,
                ImageUrl = group.ImageUrl,
                AdminDisplayName = !string.IsNullOrWhiteSpace(group.Admin?.FullName)
                    ? group.Admin.FullName
                    : group.Admin?.UserName ?? string.Empty,
                CurrentUserId = currentUserId,
                DateCreated = group.DateCreated,
                MembersCount = acceptedMembersCount + (adminHasAcceptedMembership ? 0 : 1),
                IsAdmin = isAdmin,
                IsMember = isAdmin || isAcceptedMember,
                HasPendingJoinRequest = memberships.Any(m => m.UserId == currentUserId && m.Status == MembershipStatus.PendingJoinRequest),
                HasPendingInvitation = pendingInvitation != null,
                PendingInvitationMembershipId = pendingInvitation?.Id,
                Members = acceptedMembers
            };
        }

        public static GroupMembershipDto ToMembershipDto(GroupMembership membership)
        {
            return new GroupMembershipDto
            {
                Id = membership.Id,
                GroupId = membership.GroupId,
                UserId = membership.UserId,
                Username = membership.User?.UserName,
                FullName = membership.User?.FullName,
                Status = membership.Status,
                CreatedAt = membership.CreatedAt,
                JoinedAt = membership.JoinedAt,
                RespondedAt = membership.RespondedAt
            };
        }

        public static int GetVisibleMembersCount(Group group)
        {
            var memberships = group.Memberships ?? new List<GroupMembership>();
            var acceptedMembersCount = memberships.Count(m => m.Status == MembershipStatus.Accepted);
            var adminHasAcceptedMembership = memberships.Any(m => m.UserId == group.AdminId && m.Status == MembershipStatus.Accepted);

            return acceptedMembersCount + (adminHasAcceptedMembership ? 0 : 1);
        }
    }
}
