using FluentValidation;
using SportsBookingAPI.DTOs;

namespace SportsBookingAPI.Validators
{
    public class CreateGroupDtoValidator : AbstractValidator<CreateGroupDto>
    {
        public CreateGroupDtoValidator()
        {
            RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required.");
            RuleFor(x => x.CityId).GreaterThan(0).WithMessage("City is required.");
            RuleFor(x => x.SportCategory).NotEmpty().WithMessage("Sport category is required.");
        }
    }
}
