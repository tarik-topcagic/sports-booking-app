using FluentValidation;
using SportsBookingAPI.DTOs;

namespace SportsBookingAPI.Validators
{
    public class UpdateGroupPictureDtoValidator : AbstractValidator<UpdateGroupPictureDto>
    {
        public UpdateGroupPictureDtoValidator()
        {
            RuleFor(x => x.File)
                .Must(file => file != null && file.Length > 0)
                .WithMessage("No picture selected.");
        }
    }
}
