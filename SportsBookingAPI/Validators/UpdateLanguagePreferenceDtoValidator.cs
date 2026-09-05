using FluentValidation;
using SportsBookingAPI.DTOs;
using SportsBookingAPI.Services;

namespace SportsBookingAPI.Validators
{
    public class UpdateLanguagePreferenceDtoValidator : AbstractValidator<UpdateLanguagePreferenceDto>
    {
        public UpdateLanguagePreferenceDtoValidator()
        {
            RuleFor(x => x.LanguagePreference)
                .NotEmpty().WithMessage("Language preference is required.")
                .Must(value => UserSettingsService.SupportedLanguagePreferences.Contains(value))
                .WithMessage("Unsupported application language.");
        }
    }
}
