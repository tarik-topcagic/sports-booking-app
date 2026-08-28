namespace SportsBookingAPI.DTOs
{
    public class CreateReservationDto
    {
        public int ArenaId { get; set; }
        public DateTime StartTime { get; set; }
        public double DurationInHours { get; set; }
        public string CardLast4 { get; set; } = string.Empty;
    }
}
