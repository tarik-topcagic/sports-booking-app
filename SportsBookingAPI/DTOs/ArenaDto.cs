namespace SportsBookingAPI.DTOs
{
    public class ArenaDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string City { get; set; } = string.Empty;
        public int CityId { get; set; }
        public string SportType { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string ImageUrl { get; set; } = string.Empty;
        public decimal PricePerHour { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
