using Microsoft.EntityFrameworkCore;
using SportsBookingAPI.Data;
using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Repositories
{
    public class GroupRepository : IGroupRepository
    {
        private readonly ApplicationDBContext _context;
        private readonly ILogger<GroupRepository> _logger;

        public GroupRepository(ApplicationDBContext context, ILogger<GroupRepository> logger)
        {
            _context = context;
            _logger = logger;
        }
        public async Task AddMembershipAsync(GroupMembership membership)
        {
            _context.GroupMemberships.Add(membership);
            await _context.SaveChangesAsync();
        }

        public async Task<Group> CreateGroupAsync(Group group)
        {
            _context.Groups.Add(group);
            await _context.SaveChangesAsync();
            return group;
        }

        public async Task DeleteGroupAsync(int groupId)
        {
            try
            {
                var executionStrategy = _context.Database.CreateExecutionStrategy();

                await executionStrategy.ExecuteAsync(async () =>
                {
                    await using var transaction = await _context.Database.BeginTransactionAsync();

                    var groupExists = await _context.Groups.AnyAsync(g => g.Id == groupId);
                    if (!groupExists)
                    {
                        return;
                    }

                    await _context.Database.ExecuteSqlInterpolatedAsync($@"
                        DELETE FROM ""GroupMessageReceipts""
                        WHERE ""GroupMessageId"" IN (
                        SELECT ""Id"" FROM ""GroupMessages"" WHERE ""GroupId"" = {groupId}
                    )");

                    await _context.Database.ExecuteSqlInterpolatedAsync($@"
                        DELETE FROM ""GroupMessages""
                        WHERE ""GroupId"" = {groupId}");

                    await _context.Database.ExecuteSqlInterpolatedAsync($@"
                        DELETE FROM ""GroupChatReadStates""
                        WHERE ""GroupId"" = {groupId}");

                    await _context.Database.ExecuteSqlInterpolatedAsync($@"
                        DELETE FROM ""Notifications""
                        WHERE ""GroupId"" = {groupId}");

                    await _context.Database.ExecuteSqlInterpolatedAsync($@"
                        DELETE FROM ""Notifications""
                        WHERE ""MembershipId"" IN (
                        SELECT ""Id"" FROM ""GroupMemberships"" WHERE ""GroupId"" = {groupId}
                    )");

                    await _context.Database.ExecuteSqlInterpolatedAsync($@"
                        DELETE FROM ""GroupMemberships""
                        WHERE ""GroupId"" = {groupId}");

                    await _context.Database.ExecuteSqlInterpolatedAsync($@"
                        DELETE FROM ""Groups""
                        WHERE ""Id"" = {groupId}");

                    await transaction.CommitAsync();
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(
                    ex,
                    "Error in GroupRepository.DeleteGroupAsync for group {GroupId}. Message: {Message}. InnerException: {InnerException}. StackTrace: {StackTrace}",
                    groupId,
                    ex.Message,
                    ex.InnerException?.ToString(),
                    ex.StackTrace
                );

                throw;
            }
        }

        public async Task<IEnumerable<Group>> GetAllGroupsAsync(string? name, string? owner)
        {
            var query = _context.Groups
                .Include(g => g.Admin)
                .Include(g => g.Memberships)
                .ThenInclude(m => m.User)
                .Include(g => g.CityRef)
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(name))
            {
                var normalizedName = name.Trim().ToLower();
                query = query.Where(g => g.Name.ToLower().Contains(normalizedName));
            }

            if (!string.IsNullOrWhiteSpace(owner))
            {
                var normalizedOwner = owner.Trim().ToLower();
                query = query.Where(g => g.Admin != null && (
                    (g.Admin.FullName != null && g.Admin.FullName.ToLower().Contains(normalizedOwner)) ||
                    (g.Admin.UserName != null && g.Admin.UserName.ToLower().Contains(normalizedOwner))
                ));
            }

            return await query.ToListAsync();
        }

        public async Task<Group?> GetGroupByIdAsync(int groupId)
        {
            return await _context.Groups
                .Include(g => g.Admin)
                .Include(g => g.Memberships)
                .ThenInclude(m => m.User)
                .Include(g => g.CityRef)
                .FirstOrDefaultAsync(g => g.Id == groupId);
        }

        public async Task<IEnumerable<Group>> GetGroupsByAdminAsync(string adminId)
        {
            return await _context.Groups
                .Include(g => g.Memberships)
                .Include(g => g.CityRef)
                .Where(g => g.AdminId == adminId).ToListAsync();
        }

        public async Task<IEnumerable<Group>> GetMemberGroupsAsync(string userId)
        {
            return await _context.Groups
                .Include(g => g.Memberships)
                .Include(g => g.CityRef)
                .Where(g => g.Memberships.Any(m => m.UserId == userId && m.Status == MembershipStatus.Accepted) && g.AdminId != userId)
                .ToListAsync();
        }

        public async Task<IEnumerable<Group>> GetPendingJoinRequestGroupsAsync(string userId)
        {
            return await _context.Groups
                .Include(g => g.Memberships)
                .Include(g => g.CityRef)
                .Where(g => g.AdminId != userId
                    && g.Memberships.Any(m => m.UserId == userId && m.Status == MembershipStatus.PendingJoinRequest))
                .ToListAsync();
        }

        public async Task<IEnumerable<Group>> GetPendingInvitationGroupsAsync(string userId)
        {
            return await _context.Groups
                .Include(g => g.Memberships)
                .Include(g => g.CityRef)
                .Where(g => g.AdminId != userId
                    && g.Memberships.Any(m => m.UserId == userId && m.Status == MembershipStatus.PendingInvitation))
                .ToListAsync();
        }

        public async Task<GroupMembership?> GetMembershipByIdAsync(int membershipId)
        {
            return await _context.GroupMemberships
                .Include(m => m.User)
                .Include(m => m.group)
                .ThenInclude(g => g.Admin)
                .FirstOrDefaultAsync(m => m.Id == membershipId);
        }

        public async Task<GroupMembership?> GetMembershipAsync(int groupId, string userId)
        {
            return await _context.GroupMemberships
                .Include(m => m.User)
                .FirstOrDefaultAsync(m => m.GroupId == groupId && m.UserId == userId);
        }

        public async Task<IEnumerable<GroupMembership>> GetMembershipsForGroupAsync(int groupId)
        {
            return await _context.GroupMemberships
                .Where(m => m.GroupId == groupId)
                .Include(m => m.User)
                .ToListAsync();
        }

        public async Task<IEnumerable<GroupMembership>> GetMembershipsForUserAsync(string userId)
        {
            return await _context.GroupMemberships
                .Where(m => m.UserId == userId)
                .Include(m => m.User)
                .Include(m => m.group)
                .ToListAsync();
        }

        public async Task<bool> ShareAcceptedGroupAsync(string firstUserId, string secondUserId)
        {
            return await _context.Groups.AnyAsync(group =>
                (group.AdminId == firstUserId || group.Memberships.Any(membership =>
                    membership.UserId == firstUserId
                    && membership.Status == MembershipStatus.Accepted))
                && (group.AdminId == secondUserId || group.Memberships.Any(membership =>
                    membership.UserId == secondUserId
                    && membership.Status == MembershipStatus.Accepted)));
        }

        public async Task<IReadOnlyList<string>> GetPresenceViewerUserIdsAsync(string userId)
        {
            var groups = await _context.Groups
                .Where(group => group.AdminId == userId
                    || group.Memberships.Any(membership =>
                        membership.UserId == userId
                        && membership.Status == MembershipStatus.Accepted))
                .Select(group => new
                {
                    group.AdminId,
                    AcceptedUserIds = group.Memberships
                        .Where(membership => membership.Status == MembershipStatus.Accepted)
                        .Select(membership => membership.UserId)
                })
                .ToListAsync();

            var viewerIds = new HashSet<string>();

            foreach (var group in groups)
            {
                if (!string.Equals(group.AdminId, userId, StringComparison.Ordinal))
                {
                    viewerIds.Add(group.AdminId);
                }

                foreach (var acceptedUserId in group.AcceptedUserIds)
                {
                    if (!string.Equals(acceptedUserId, userId, StringComparison.Ordinal))
                    {
                        viewerIds.Add(acceptedUserId);
                    }
                }
            }

            return viewerIds.ToList();
        }

        public async Task<IEnumerable<Group>> GetPublicGroupsAsync(string userId)
        {
            return await _context.Groups
                .Include(g => g.Memberships)
                .Include(g => g.CityRef)
                .Where(g => g.AdminId != userId
                    && !g.Memberships.Any(m => m.UserId == userId
                        && (m.Status == MembershipStatus.Accepted || m.Status == MembershipStatus.PendingInvitation)))
                .ToListAsync();
        }

        public async Task RemoveMembershipAsync(int membershipId)
        {
            var membership = await _context.GroupMemberships.FindAsync(membershipId);
            if (membership != null)
            {
                _context.GroupMemberships.Remove(membership);
                await _context.SaveChangesAsync();  
            }
        }

        public async Task<IEnumerable<Group>> SearchGroupsAsync(string query)
        {
            return await _context.Groups
                .Include(g => g.Memberships)
                .ThenInclude(m => m.User)
                .Include(g => g.CityRef)
                .Where(g => g.Name.Contains(query) || g.Description.Contains(query) || g.CityRef.Name.Contains(query) || g.SportCategory.Contains(query))
                .ToListAsync();
        }

        public async Task<bool> CityHasGroupsAsync(int cityId)
        {
            return await _context.Groups.AnyAsync(g => g.CityId == cityId);
        }

        public async Task<Group> UpdateGroupAsync(Group group)
        {
            _context.Groups.Update(group);
            await _context.SaveChangesAsync();  
            return group;
        }

        public async Task UpdateMembershipAsync(GroupMembership membership)
        {
            _context.GroupMemberships.Update(membership);
            await _context.SaveChangesAsync();
        }
    }
}
