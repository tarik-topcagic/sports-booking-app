using Microsoft.AspNetCore.Identity;

namespace SportsBookingAPI.Models
{
    public class AppUser : IdentityUser
    {
        public string FullName { get; set; } = string.Empty;
        public string ProfilePictureUrl { get; set; } = "default-profile.png";
        public int? CityId { get; set; }
        public virtual City? CityRef { get; set; }
        public bool EmailNotificationsEnabled { get; set; }
        public string LanguagePreference { get; set; } = "en";
        public DateTime? CreatedAt { get; set; }
        public virtual ICollection<GroupMembership> GroupMemberships { get; set; } = new List<GroupMembership>();
        public virtual ICollection<Group> Groups { get; set; } = new List<Group>();
        public virtual ICollection<GroupMessage> GroupMessages { get; set; } = new List<GroupMessage>();
        public virtual ICollection<GroupMessageReceipt> GroupMessageReceipts { get; set; } = new List<GroupMessageReceipt>();
        public virtual ICollection<PrivateConversation> PrivateConversationsAsUserOne { get; set; } = new List<PrivateConversation>();
        public virtual ICollection<PrivateConversation> PrivateConversationsAsUserTwo { get; set; } = new List<PrivateConversation>();
        public virtual ICollection<PrivateMessage> PrivateMessages { get; set; } = new List<PrivateMessage>();
        public virtual ICollection<PrivateChatReadState> PrivateChatReadStates { get; set; } = new List<PrivateChatReadState>();
        public virtual ICollection<AppNotification> Notifications { get; set; } = new List<AppNotification>();
    }
}
