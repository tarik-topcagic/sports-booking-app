using FluentValidation;
using SportsBookingAPI.DTOs;

namespace SportsBookingAPI.Validators
{
    public class UpdateProfilePictureDtoValidator : AbstractValidator<UpdateProfilePictureDto>
    {
        public UpdateProfilePictureDtoValidator()
        {
            RuleFor(x => x.File)
                .Must(file => file != null && file.Length > 0)
                .WithMessage("No image selected.");
        }
    }
}
