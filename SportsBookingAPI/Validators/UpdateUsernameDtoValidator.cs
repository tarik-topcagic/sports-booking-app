using FluentValidation;
using SportsBookingAPI.DTOs;

namespace SportsBookingAPI.Validators
{
    public class UpdateUsernameDtoValidator : AbstractValidator<UpdateUsernameDto>
    {
        public UpdateUsernameDtoValidator()
        {
            RuleFor(x => x.Username)
                .NotEmpty().WithMessage("Username is required.")
                .MinimumLength(4).WithMessage("Username must be at least 4 characters long.");
        }
    }
}
