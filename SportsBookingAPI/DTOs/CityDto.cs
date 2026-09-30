namespace SportsBookingAPI.DTOs
{
    public class CityDto
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Canton { get; set; } = string.Empty;
        public int CantonId { get; set; }
    }
}
