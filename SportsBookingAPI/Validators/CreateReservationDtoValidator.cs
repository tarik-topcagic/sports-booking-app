using FluentValidation;
using SportsBookingAPI.DTOs;

namespace SportsBookingAPI.Validators
{
    public class CreateReservationDtoValidator : AbstractValidator<CreateReservationDto>
    {
        private static readonly double[] AllowedDurations = { 1.0, 1.5, 2.0 };

        public CreateReservationDtoValidator()
        {
            RuleFor(x => x.ArenaId)
                .GreaterThan(0).WithMessage("A valid arena is required.");

            RuleFor(x => x.StartTime)
                .NotEmpty().WithMessage("Start time is required.");

            RuleFor(x => x.DurationInHours)
                .Must(duration => AllowedDurations.Contains(duration))
                .WithMessage("Duration in hours must be one of the following values: 1, 1.5, 2");

            RuleFor(x => x.CardLast4)
                .NotEmpty().WithMessage("Card last 4 digits is required.")
                .Matches(@"^\d{4}$").WithMessage("Card last 4 digits must be exactly 4 digits");
        }
    }
}
