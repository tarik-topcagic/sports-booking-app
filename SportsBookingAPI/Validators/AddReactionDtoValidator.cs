using FluentValidation;
using SportsBookingAPI.DTOs;

namespace SportsBookingAPI.Validators
{
    public class AddReactionDtoValidator : AbstractValidator<AddReactionDto>
    {
        public AddReactionDtoValidator()
        {
            RuleFor(x => x.Emoji)
                .NotEmpty().WithMessage("Emoji is required.")
                .MaximumLength(8).WithMessage("Emoji must not exceed 8 characters.");
        }
    }
}
