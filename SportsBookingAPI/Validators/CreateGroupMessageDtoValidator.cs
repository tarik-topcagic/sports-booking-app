using FluentValidation;
using SportsBookingAPI.DTOs;

namespace SportsBookingAPI.Validators
{
    public class CreateGroupMessageDtoValidator : AbstractValidator<CreateGroupMessageDto>
    {
        public CreateGroupMessageDtoValidator()
        {
            RuleFor(x => x.MessageText)
                .NotEmpty().WithMessage("Message text is required.")
                .MaximumLength(10000).WithMessage("Message text must not exceed 10000 characters.");
        }
    }
}
