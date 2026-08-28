using FluentValidation;
using SportsBookingAPI.DTOs;

namespace SportsBookingAPI.Validators
{
    public class UpdateGroupDtoValidator : AbstractValidator<UpdateGroupDto>
    {
        public UpdateGroupDtoValidator()
        {
            RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required.");
            RuleFor(x => x.City).NotEmpty().WithMessage("City is required.");
            RuleFor(x => x.SportCategory).NotEmpty().WithMessage("Sport category is required.");
        }
    }
}
