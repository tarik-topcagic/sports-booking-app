using FluentValidation;
using SportsBookingAPI.DTOs;

namespace SportsBookingAPI.Validators
{
    public class RespondInviteDtoValidator : AbstractValidator<RespondInviteDto>
    {
        public RespondInviteDtoValidator()
        {
            RuleFor(x => x.MembershipId).GreaterThan(0).WithMessage("A valid membership id is required.");
        }
    }
}
