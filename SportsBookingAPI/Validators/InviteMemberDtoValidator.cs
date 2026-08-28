using FluentValidation;
using SportsBookingAPI.DTOs;

namespace SportsBookingAPI.Validators
{
    public class InviteMemberDtoValidator : AbstractValidator<InviteMemberDto>
    {
        public InviteMemberDtoValidator()
        {
            RuleFor(x => x.UserId).NotEmpty().WithMessage("User id is required.");
        }
    }
}
