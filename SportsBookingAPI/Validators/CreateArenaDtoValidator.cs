using FluentValidation;
using SportsBookingAPI.DTOs.Admin;

namespace SportsBookingAPI.Validators
{
    public class CreateArenaDtoValidator : AbstractValidator<CreateArenaDto>
    {
        public CreateArenaDtoValidator()
        {
            RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required.");
            RuleFor(x => x.Description).NotEmpty().WithMessage("Description is required.");
            RuleFor(x => x.CityId).GreaterThan(0).WithMessage("City is required.");
            RuleFor(x => x.SportType).NotEmpty().WithMessage("Sport type is required.");
            RuleFor(x => x.Address).NotEmpty().WithMessage("Address is required.");
            RuleFor(x => x.PricePerHour)
                .GreaterThanOrEqualTo(0).WithMessage("Price per hour must be a positive value.");
        }
    }
}
