using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Data
{
    public class ApplicationDBContext : IdentityDbContext<AppUser>
    {
        public ApplicationDBContext(DbContextOptions<ApplicationDBContext> options) : base(options)
        {
            

        }
        public DbSet<City> Cities { get; set; }
        public DbSet<Arena> Arenas { get; set; }
        public DbSet<Group> Groups { get; set; }
        public DbSet<GroupMembership> GroupMemberships { get; set; }
        public DbSet<GroupMessage> GroupMessages { get; set; }
        public DbSet<GroupMessageReceipt> GroupMessageReceipts { get; set; }
        public DbSet<GroupMessageReaction> GroupMessageReactions { get; set; }
        public DbSet<GroupChatReadState> GroupChatReadStates { get; set; }
        public DbSet<PrivateConversation> PrivateConversations { get; set; }
        public DbSet<PrivateMessage> PrivateMessages { get; set; }
        public DbSet<PrivateMessageReaction> PrivateMessageReactions { get; set; }
        public DbSet<PrivateChatReadState> PrivateChatReadStates { get; set; }
        public DbSet<AppNotification> Notifications { get; set; }
        public DbSet<Reservation> Reservations { get; set; }
        public DbSet<FavoriteArena> FavoriteArenas { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<AppUser>()
                .Property(user => user.LanguagePreference)
                .HasDefaultValue("bs")
                .HasMaxLength(8);

            modelBuilder.Entity<Arena>()
                .Property(arena => arena.Name)
                .HasMaxLength(160);

            modelBuilder.Entity<Arena>()
                .Property(arena => arena.City)
                .HasMaxLength(80);

            modelBuilder.Entity<Arena>()
                .Property(arena => arena.SportType)
                .HasMaxLength(80);

            modelBuilder.Entity<Arena>()
                .Property(arena => arena.Address)
                .HasMaxLength(200);

            modelBuilder.Entity<Arena>()
                .Property(arena => arena.ImageUrl)
                .HasMaxLength(500);

            modelBuilder.Entity<Arena>()
                .Property(arena => arena.PricePerHour)
                .HasPrecision(10, 2);

            modelBuilder.Entity<Arena>()
                .HasIndex(arena => new { arena.City, arena.SportType });

            modelBuilder.Entity<Group>()
                .HasOne(g => g.Admin)
                .WithMany(u => u.Groups)
                .HasForeignKey(g => g.AdminId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<GroupMembership>()
                .HasOne(gm => gm.User)
                .WithMany(u => u.GroupMemberships)
                .HasForeignKey(gm => gm.UserId)
                .OnDelete(DeleteBehavior.Restrict); 

            modelBuilder.Entity<GroupMembership>()
                .HasOne(gm => gm.group)
                .WithMany(g => g.Memberships)
                .HasForeignKey(gm => gm.GroupId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<GroupMembership>()
                .HasIndex(gm => new { gm.GroupId, gm.UserId })
                .IsUnique();

            modelBuilder.Entity<GroupMessage>()
                .HasOne(message => message.Group)
                .WithMany(group => group.GroupMessages)
                .HasForeignKey(message => message.GroupId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<GroupMessage>()
                .HasOne(message => message.SenderUser)
                .WithMany(user => user.GroupMessages)
                .HasForeignKey(message => message.SenderUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<GroupMessage>()
                .HasIndex(message => new { message.GroupId, message.CreatedAt });

            modelBuilder.Entity<GroupMessage>()
                .HasOne(message => message.ReplyToMessage)
                .WithMany()
                .HasForeignKey(message => message.ReplyToMessageId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<GroupMessageReaction>()
                .HasOne(reaction => reaction.GroupMessage)
                .WithMany(message => message.Reactions)
                .HasForeignKey(reaction => reaction.GroupMessageId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<GroupMessageReaction>()
                .HasOne(reaction => reaction.User)
                .WithMany()
                .HasForeignKey(reaction => reaction.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<GroupMessageReaction>()
                .HasIndex(reaction => new { reaction.GroupMessageId, reaction.UserId })
                .IsUnique();

            modelBuilder.Entity<GroupMessageReceipt>()
                .HasOne(receipt => receipt.GroupMessage)
                .WithMany(message => message.Receipts)
                .HasForeignKey(receipt => receipt.GroupMessageId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<GroupMessageReceipt>()
                .HasOne(receipt => receipt.User)
                .WithMany(user => user.GroupMessageReceipts)
                .HasForeignKey(receipt => receipt.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<GroupMessageReceipt>()
                .HasIndex(receipt => new { receipt.GroupMessageId, receipt.UserId })
                .IsUnique();

            modelBuilder.Entity<GroupChatReadState>()
                .HasOne(readState => readState.Group)
                .WithMany()
                .HasForeignKey(readState => readState.GroupId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<GroupChatReadState>()
                .HasOne(readState => readState.User)
                .WithMany()
                .HasForeignKey(readState => readState.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<GroupChatReadState>()
                .HasIndex(readState => new { readState.GroupId, readState.UserId })
                .IsUnique();

            modelBuilder.Entity<PrivateConversation>()
                .HasOne(conversation => conversation.UserOne)
                .WithMany(user => user.PrivateConversationsAsUserOne)
                .HasForeignKey(conversation => conversation.UserOneId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PrivateConversation>()
                .HasOne(conversation => conversation.UserTwo)
                .WithMany(user => user.PrivateConversationsAsUserTwo)
                .HasForeignKey(conversation => conversation.UserTwoId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PrivateConversation>()
                .HasIndex(conversation => new { conversation.UserOneId, conversation.UserTwoId })
                .IsUnique();

            modelBuilder.Entity<PrivateMessage>()
                .HasOne(message => message.Conversation)
                .WithMany(conversation => conversation.PrivateMessages)
                .HasForeignKey(message => message.ConversationId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PrivateMessage>()
                .HasOne(message => message.SenderUser)
                .WithMany(user => user.PrivateMessages)
                .HasForeignKey(message => message.SenderUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PrivateMessage>()
                .HasIndex(message => new { message.ConversationId, message.CreatedAt });

            modelBuilder.Entity<PrivateMessage>()
                .HasOne(message => message.ReplyToMessage)
                .WithMany()
                .HasForeignKey(message => message.ReplyToMessageId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PrivateMessageReaction>()
                .HasOne(reaction => reaction.PrivateMessage)
                .WithMany(message => message.Reactions)
                .HasForeignKey(reaction => reaction.PrivateMessageId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PrivateMessageReaction>()
                .HasOne(reaction => reaction.User)
                .WithMany()
                .HasForeignKey(reaction => reaction.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PrivateMessageReaction>()
                .HasIndex(reaction => new { reaction.PrivateMessageId, reaction.UserId })
                .IsUnique();

            modelBuilder.Entity<PrivateChatReadState>()
                .HasOne(readState => readState.Conversation)
                .WithMany()
                .HasForeignKey(readState => readState.ConversationId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PrivateChatReadState>()
                .HasOne(readState => readState.User)
                .WithMany(user => user.PrivateChatReadStates)
                .HasForeignKey(readState => readState.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<PrivateChatReadState>()
                .HasIndex(readState => new { readState.ConversationId, readState.UserId })
                .IsUnique();

            modelBuilder.Entity<AppNotification>()
                .HasOne(n => n.User)
                .WithMany(u => u.Notifications)
                .HasForeignKey(n => n.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<AppNotification>()
                .HasOne(n => n.ActorUser)
                .WithMany()
                .HasForeignKey(n => n.ActorUserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<AppNotification>()
                .HasOne(n => n.Group)
                .WithMany()
                .HasForeignKey(n => n.GroupId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<AppNotification>()
                .HasOne(n => n.Membership)
                .WithMany()
                .HasForeignKey(n => n.MembershipId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<AppNotification>()
                .HasOne(n => n.Reservation)
                .WithMany()
                .HasForeignKey(n => n.ReservationId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<AppNotification>()
                .HasIndex(n => new { n.UserId, n.IsRead, n.CreatedAt });

            modelBuilder.Entity<Reservation>()
                .HasOne(r => r.Arena)
                .WithMany()
                .HasForeignKey(r => r.ArenaId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Reservation>()
                .HasOne(r => r.User)
                .WithMany()
                .HasForeignKey(r => r.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<Reservation>()
                .HasIndex(r => new { r.ArenaId, r.StartTime })
                .IsUnique()
                .HasFilter("\"Status\" = 0");

            modelBuilder.Entity<Reservation>()
                .Property(r => r.CardLast4)
                .HasMaxLength(4);

            modelBuilder.Entity<FavoriteArena>()
                .HasOne(f => f.Arena)
                .WithMany()
                .HasForeignKey(f => f.ArenaId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<FavoriteArena>()
                .HasOne(f => f.User)
                .WithMany()
                .HasForeignKey(f => f.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            modelBuilder.Entity<FavoriteArena>()
                .HasIndex(f => new { f.UserId, f.ArenaId })
                .IsUnique();
        }

    }
}
