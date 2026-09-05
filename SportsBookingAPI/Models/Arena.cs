namespace SportsBookingAPI.Models
{
    public class Arena
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int CityId { get; set; }
        public virtual City CityRef { get; set; } = null!;
        public string SportType { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public string ImageUrl { get; set; } = string.Empty;
        public decimal PricePerHour { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
