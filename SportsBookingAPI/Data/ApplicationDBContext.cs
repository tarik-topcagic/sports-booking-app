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

            modelBuilder.Entity<Arena>()
                .HasData(GetSeedArenas());

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

        private static Arena[] GetSeedArenas()
        {
            return
            [
                new Arena
                {
                    Id = 1,
                    Name = "Arena Koševo Center",
                    Description = "Otvoreni teren smješten tik uz gradske saobraćajnice i nekoliko kafića, pa je pogodan za rekreativne i takmičarske termine. Reflektori pružaju vrlo dobro večernje osvjetljenje, a teren se redovno održava tokom cijele sezone. Na raspolaganju su svlačionice, manji tribinski prostor i parking u neposrednoj blizini.",
                    City = "Sarajevo",
                    SportType = "Football",
                    PricePerHour = 50,
                    Address = "Patriotske lige 41, Sarajevo",
                    ImageUrl = BuildArenaImageUrl("photorealistic modern outdoor football arena in Sarajevo, Balkan sports center architecture, empty artificial turf field, stadium lights, small seating area, fences, evening atmosphere, no players, no logos", 1001),
                    CreatedAt = new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc)
                },
                new Arena
                {
                    Id = 2,
                    Name = "Skenderija Basket Hall",
                    Description = "Moderna dvorana sa parketom pogodnim za treninge klubova, škola košarke i rekreativne mečeve. Unutrašnji prostor je dobro ventilisan, a gledalište omogućava ugodno praćenje utakmica za manju publiku. U objektu se nalaze svlačionice, sanitarni čvorovi i recepcijski prostor.",
                    City = "Sarajevo",
                    SportType = "Basketball",
                    PricePerHour = 42,
                    Address = "Terezija bb, Sarajevo",
                    ImageUrl = BuildArenaImageUrl("photorealistic indoor basketball hall in Sarajevo, modern European sports facility, polished wooden court, seating stands, ceiling lights, empty arena, realistic architecture, no players, no logos", 1002),
                    CreatedAt = new DateTime(2026, 5, 1, 0, 0, 0, DateTimeKind.Utc)
                },
                new Arena
                {
                    Id = 3,
                    Name = "Padel Vista Marijin Dvor",
                    Description = "Padel centar otvorenog tipa sa kvalitetnom podlogom i zaštitnim staklenim panelima koji dobro drže ritam igre. Arena ima večernju rasvjetu, rezervisana parking mjesta i lounge zonu za odmor između termina. Lokacija je praktična za dolazak iz više dijelova grada.",
                    City = "Sarajevo",
                    SportType = "Padel",
                    PricePerHour = 36,
                    Address = "Fra Anđela Zvizdovića 8, Sarajevo",
                    ImageUrl = BuildArenaImageUrl("photorealistic outdoor padel court complex in Sarajevo, glass walls, modern Balkan sports center, evening lighting, spectator benches, fenced courts, empty facility, no players, no logos", 1003),
                    CreatedAt = new DateTime(2026, 5, 2, 0, 0, 0, DateTimeKind.Utc)
                },
                new Arena
                {
                    Id = 4,
                    Name = "Velež Sport Park",
                    Description = "Otvoreni nogometni kompleks s prirodnim osjećajem terena i uredno obilježenim linijama za rekreativne lige. Prostor je osvijetljen za večernje termine, a uz teren se nalazi nekoliko klupa i manja natkrivena zona za gledaoce. Arena je posebno popularna među ekipama koje žele termin u mirnijem dijelu grada.",
                    City = "Mostar",
                    SportType = "Football",
                    PricePerHour = 50,
                    Address = "Maršala Tita 178, Mostar",
                    ImageUrl = BuildArenaImageUrl("photorealistic outdoor football sports park in Mostar, Balkan urban setting, green field, floodlights, fences, modest grandstand, warm stone architecture, empty facility, no players, no logos", 1004),
                    CreatedAt = new DateTime(2026, 5, 2, 0, 0, 0, DateTimeKind.Utc)
                },
                new Arena
                {
                    Id = 5,
                    Name = "Neretva Basket House",
                    Description = "Zatvorena košarkaška dvorana sa stabilnom rasvjetom i vrlo dobrim akustičnim uslovima za trening i turnire. Parket je redovno održavan, a uz salu su dostupne svlačionice, tuševi i manja tribina. U blizini se nalaze parking mjesta i nekoliko ugostiteljskih objekata.",
                    City = "Mostar",
                    SportType = "Basketball",
                    PricePerHour = 42,
                    Address = "Kneza Branimira 12, Mostar",
                    ImageUrl = BuildArenaImageUrl("photorealistic indoor basketball arena in Mostar, modern sports hall, hardwood court, bright roof lighting, compact spectator area, clean European design, empty facility, no players, no logos", 1005),
                    CreatedAt = new DateTime(2026, 5, 3, 0, 0, 0, DateTimeKind.Utc)
                },
                new Arena
                {
                    Id = 6,
                    Name = "Padel Club Buna",
                    Description = "Mirniji padel kompleks smješten nedaleko od gradskog jezgra, idealan za rekreativce i manje turnire. Tereni su na otvorenom, imaju snažno noćno osvjetljenje i dovoljno prostora oko staklenih ograda za sigurnu igru. Gostima su na raspolaganju parking, svlačionice i terasa za odmor.",
                    City = "Mostar",
                    SportType = "Padel",
                    PricePerHour = 36,
                    Address = "Bulevar narodne revolucije 21, Mostar",
                    ImageUrl = BuildArenaImageUrl("photorealistic outdoor padel club in Mostar, glass padel courts, Mediterranean Balkan atmosphere, modern lighting, lounge terrace, clean fences, empty facility, no players, no logos", 1006),
                    CreatedAt = new DateTime(2026, 5, 3, 0, 0, 0, DateTimeKind.Utc)
                },
                new Arena
                {
                    Id = 7,
                    Name = "Tušanj Arena 5+",
                    Description = "Nogometni teren sa umjetnom travom projektovan za dinamične termine malog fudbala i treninge mlađih selekcija. Reflektori pokrivaju čitavu površinu, a pored terena postoji dovoljno prostora za zagrijavanje i kratki odmor. Kompleks nudi svlačionice, parking i pristup glavnim gradskim saobraćajnicama.",
                    City = "Tuzla",
                    SportType = "Football",
                    PricePerHour = 50,
                    Address = "Rudarska 2, Tuzla",
                    ImageUrl = BuildArenaImageUrl("photorealistic small football arena in Tuzla, empty synthetic turf field, floodlights, fences, parking nearby, modern Bosnian sports facility, overcast daylight, no players, no logos", 1007),
                    CreatedAt = new DateTime(2026, 5, 4, 0, 0, 0, DateTimeKind.Utc)
                },
                new Arena
                {
                    Id = 8,
                    Name = "Mejdan Basket Arena",
                    Description = "Višenamjenska dvorana sa kvalitetnim parketom i odličnom preglednošću terena iz gledališta. Prostor je pogodan za treninge, prijateljske utakmice i školske turnire, uz uredne svlačionice i pomoćne prostorije. Lokacija u sportskom centru olakšava pristup i organizaciju događaja.",
                    City = "Tuzla",
                    SportType = "Basketball",
                    PricePerHour = 42,
                    Address = "Bosne Srebrene 55, Tuzla",
                    ImageUrl = BuildArenaImageUrl("photorealistic indoor basketball sports hall in Tuzla, clean wooden court, bright lighting, tiered seating, modern Balkan civic arena, empty facility, no players, no logos", 1008),
                    CreatedAt = new DateTime(2026, 5, 4, 0, 0, 0, DateTimeKind.Utc)
                },
                new Arena
                {
                    Id = 9,
                    Name = "Padel Panonika",
                    Description = "Padel teren u modernom rekreativnom kompleksu, poznat po urednoj podlozi i prijatnom ambijentu tokom cijelog dana. Reflektori omogućavaju stabilnu igru i u kasnijim večernjim satima, a gostima su dostupni garderoberi i caffe zona. Posebna prednost je blizina parkinga i centra grada.",
                    City = "Tuzla",
                    SportType = "Padel",
                    PricePerHour = 36,
                    Address = "Šetalište Slana banja 18, Tuzla",
                    ImageUrl = BuildArenaImageUrl("photorealistic outdoor padel arena in Tuzla, modern glass courts, evening lights, urban recreational zone, fenced facility, empty courts, no players, no logos", 1009),
                    CreatedAt = new DateTime(2026, 5, 5, 0, 0, 0, DateTimeKind.Utc)
                },
                new Arena
                {
                    Id = 10,
                    Name = "Krajina Football Hub",
                    Description = "Otvorena arena za mali fudbal sa čvrstom umjetnom travom i vrlo dobrom drenažom nakon kiše. Teren je osvijetljen, ograda je uredna i sigurna, a uz objekat se nalaze svlačionice i prostor za kraće zadržavanje ekipa. Arena često okuplja rekreativne lige i vikend turnire.",
                    City = "Banja Luka",
                    SportType = "Football",
                    PricePerHour = 50,
                    Address = "Kralja Petra I Karađorđevića 91, Banja Luka",
                    ImageUrl = BuildArenaImageUrl("photorealistic football hub in Banja Luka, empty artificial grass pitch, European sports facility, perimeter fences, floodlights, modest stands, modern architecture, no players, no logos", 1010),
                    CreatedAt = new DateTime(2026, 5, 5, 0, 0, 0, DateTimeKind.Utc)
                },
                new Arena
                {
                    Id = 11,
                    Name = "Borik Basket Zone",
                    Description = "Košarkaška dvorana poznata po ravnomjernom osvjetljenju i dobro održavanom parketu koji odgovara i intenzivnijim treninzima. U sklopu objekta nalaze se svlačionice, prostor za trenere i manja zona za gledaoce. U neposrednoj blizini postoji više parking mjesta i pristup glavnim ulicama.",
                    City = "Banja Luka",
                    SportType = "Basketball",
                    PricePerHour = 42,
                    Address = "Aleja Svetog Save 48, Banja Luka",
                    ImageUrl = BuildArenaImageUrl("photorealistic indoor basketball court in Banja Luka, bright sports hall lighting, polished parquet, spectator seating, contemporary Balkan arena interior, empty facility, no players, no logos", 1011),
                    CreatedAt = new DateTime(2026, 5, 6, 0, 0, 0, DateTimeKind.Utc)
                },
                new Arena
                {
                    Id = 12,
                    Name = "Padel Riverside Vrbas",
                    Description = "Padel centar sa otvorenim terenima i prijatnim ambijentom uz rijeku, što ga čini popularnim za popodnevne i večernje termine. Podloga je brza, staklene ograde su kvalitetne, a osvjetljenje ravnomjerno raspoređeno. Gosti imaju pristup parkingu, garderoberima i zoni za osvježenje.",
                    City = "Banja Luka",
                    SportType = "Padel",
                    PricePerHour = 36,
                    Address = "Cara Lazara 77, Banja Luka",
                    ImageUrl = BuildArenaImageUrl("photorealistic outdoor padel complex near river in Banja Luka, modern glass courts, elegant lighting, landscaped sports center, empty facility, no players, no logos", 1012),
                    CreatedAt = new DateTime(2026, 5, 6, 0, 0, 0, DateTimeKind.Utc)
                },
                new Arena
                {
                    Id = 13,
                    Name = "Una Football Point",
                    Description = "Nogometni teren u mirnijem dijelu Bihaća, pogodan za termine prijateljskih ekipa i školskih sekcija. Reflektori pružaju dobru vidljivost, a uz teren postoje klupe za igrače i mali prostor za gledaoce. Površina terena je uredna i pogodna za cjelogodišnje korištenje.",
                    City = "Bihać",
                    SportType = "Football",
                    PricePerHour = 50,
                    Address = "5. korpusa 14, Bihać",
                    ImageUrl = BuildArenaImageUrl("photorealistic outdoor football terrain in Bihac, empty field, fences, tribune benches, clean Balkan sports center, natural daylight, parking and trees nearby, no players, no logos", 1013),
                    CreatedAt = new DateTime(2026, 5, 7, 0, 0, 0, DateTimeKind.Utc)
                },
                new Arena
                {
                    Id = 14,
                    Name = "Dvorana Sokol Basket",
                    Description = "Zatvoreni košarkaški prostor sa ugodnom atmosferom i parketom koji dobro podnosi česte treninge. Arena je pogodna za omladinske selekcije i rekreativne mečeve, uz svlačionice i pristojan prostor za publiku. Lokacija je lako dostupna i u blizini ima dovoljno parking mjesta.",
                    City = "Bihać",
                    SportType = "Basketball",
                    PricePerHour = 42,
                    Address = "Harmanski sokak 9, Bihać",
                    ImageUrl = BuildArenaImageUrl("photorealistic indoor basketball hall in Bihac, hardwood court, bright ceiling lighting, modest stands, local European sports facility, empty arena, no players, no logos", 1014),
                    CreatedAt = new DateTime(2026, 5, 7, 0, 0, 0, DateTimeKind.Utc)
                },
                new Arena
                {
                    Id = 15,
                    Name = "Padel Una Gardens",
                    Description = "Otvoreni padel kompleks sa čistim linijama terena i dobro održavanom podlogom za rekreativnu i takmičarsku igru. Prostor ima rasvjetu za noćne termine, svlačionice i manji lounge kutak za ekipe nakon meča. Blizina zelenih zona daje cijelom centru opušten i prijatan dojam.",
                    City = "Bihać",
                    SportType = "Padel",
                    PricePerHour = 36,
                    Address = "Bedem 23, Bihać",
                    ImageUrl = BuildArenaImageUrl("photorealistic outdoor padel gardens in Bihac, glass wall courts, green surroundings, evening lights, modern recreational center, empty facility, no players, no logos", 1015),
                    CreatedAt = new DateTime(2026, 5, 8, 0, 0, 0, DateTimeKind.Utc)
                },
                new Arena
                {
                    Id = 16,
                    Name = "Bilino Football Arena",
                    Description = "Arena za mali fudbal sa kvalitetnom umjetnom travom i vrlo dobrom preglednošću cijele površine. Reflektori i zaštitna ograda omogućavaju sigurne večernje termine, a u sklopu centra nalaze se svlačionice i parking. Često je izbor ekipa koje traže centralnu lokaciju u Zenici.",
                    City = "Zenica",
                    SportType = "Football",
                    PricePerHour = 50,
                    Address = "Bulevar Kralja Tvrtka I 6, Zenica",
                    ImageUrl = BuildArenaImageUrl("photorealistic football arena in Zenica, empty artificial turf, powerful floodlights, fences, compact stands, urban Balkan sports facility, no players, no logos", 1016),
                    CreatedAt = new DateTime(2026, 5, 8, 0, 0, 0, DateTimeKind.Utc)
                },
                new Arena
                {
                    Id = 17,
                    Name = "Arena Kamberovića Basket",
                    Description = "Unutrašnja dvorana sa profesionalnim osjećajem prostora, pogodna za treninge klubova i rekreativne utakmice. Parket je u dobrom stanju, rasvjeta je ravnomjerna, a manja tribina omogućava prisustvo publike bez gužve. Korisnicima su dostupne svlačionice, sanitarni čvorovi i prateći sadržaji.",
                    City = "Zenica",
                    SportType = "Basketball",
                    PricePerHour = 42,
                    Address = "Prve zeničke brigade 3, Zenica",
                    ImageUrl = BuildArenaImageUrl("photorealistic indoor basketball arena in Zenica, polished wood floor, balanced lighting, spectator tribune, contemporary European sports hall, empty facility, no players, no logos", 1017),
                    CreatedAt = new DateTime(2026, 5, 9, 0, 0, 0, DateTimeKind.Utc)
                },
                new Arena
                {
                    Id = 18,
                    Name = "Padel City Zen",
                    Description = "Savremeni padel teren sa urednim staklenim panelima, kvalitetnim osvjetljenjem i dovoljno prostora oko terena za udobno kretanje igrača. Centar je pogodan i za početnike i za naprednije rekreativce, a uz teren se nalaze parking i zona za odmor. Atmosfera je mirna, ali dovoljno živahna za turnirske dane.",
                    City = "Zenica",
                    SportType = "Padel",
                    PricePerHour = 36,
                    Address = "Londža 41, Zenica",
                    ImageUrl = BuildArenaImageUrl("photorealistic modern padel center in Zenica, empty glass courts, evening lights, fences, sleek Balkan sports architecture, realistic facility atmosphere, no players, no logos", 1018),
                    CreatedAt = new DateTime(2026, 5, 9, 0, 0, 0, DateTimeKind.Utc)
                }
            ];
        }

        private static string BuildArenaImageUrl(string prompt, int seed)
        {
            var encodedPrompt = Uri.EscapeDataString(prompt);
            return $"https://image.pollinations.ai/prompt/{encodedPrompt}?width=1280&height=720&seed={seed}&model=flux&nologo=true&private=true";
        }
    }
}
