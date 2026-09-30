namespace SportsBookingAPI.DTOs.Admin
{
    public class CreateCityDto
    {
        public string Name { get; set; } = string.Empty;
        public int CantonId { get; set; }
    }
}
