using FluentValidation;
using SportsBookingAPI.DTOs.Admin;

namespace SportsBookingAPI.Validators
{
    public class CreateCityDtoValidator : AbstractValidator<CreateCityDto>
    {
        public CreateCityDtoValidator()
        {
            RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required.");
            RuleFor(x => x.Canton).NotEmpty().WithMessage("Canton is required.");
        }
    }
}
