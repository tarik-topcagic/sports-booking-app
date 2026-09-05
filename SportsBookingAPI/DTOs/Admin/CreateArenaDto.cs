namespace SportsBookingAPI.DTOs.Admin
{
    public class CreateArenaDto
    {
        public string Name { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int CityId { get; set; }
        public string SportType { get; set; } = string.Empty;
        public string Address { get; set; } = string.Empty;
        public decimal PricePerHour { get; set; }
    }
}
