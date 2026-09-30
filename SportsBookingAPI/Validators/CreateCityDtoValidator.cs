using FluentValidation;
using SportsBookingAPI.DTOs.Admin;
using SportsBookingAPI.Interfaces;

namespace SportsBookingAPI.Validators
{
    public class CreateCityDtoValidator : AbstractValidator<CreateCityDto>
    {
        public CreateCityDtoValidator(ICantonRepository cantonRepository)
        {
            RuleFor(x => x.Name).NotEmpty().WithMessage("Name is required.");

            RuleFor(x => x.CantonId)
                .GreaterThan(0).WithMessage("Canton is required.")
                .MustAsync(async (cantonId, cancellationToken) => await cantonRepository.ExistsByIdAsync(cantonId))
                .WithMessage("Selected canton does not exist.")
                .When(x => x.CantonId > 0);
        }
    }
}
