using FluentValidation;
using SportsBookingAPI.DTOs;

namespace SportsBookingAPI.Validators
{
    public class RespondJoinRequestDtoValidator : AbstractValidator<RespondJoinRequestDto>
    {
        public RespondJoinRequestDtoValidator()
        {
            RuleFor(x => x.MembershipId).GreaterThan(0).WithMessage("A valid membership id is required.");
        }
    }
}
