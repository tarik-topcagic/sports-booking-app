using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace SportsBookingAPI.Filters
{
    public class FluentValidationActionFilter : IAsyncActionFilter
    {
        public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
        {
            foreach (var argument in context.ActionArguments.Values)
            {
                if (argument == null)
                    continue;

                var validatorType = typeof(IValidator<>).MakeGenericType(argument.GetType());
                if (context.HttpContext.RequestServices.GetService(validatorType) is not IValidator validator)
                    continue;

                var validationContext = new ValidationContext<object>(argument);
                var validationResult = await validator.ValidateAsync(validationContext);

                if (!validationResult.IsValid)
                {
                    var firstError = validationResult.Errors[0];
                    context.Result = new BadRequestObjectResult(new
                    {
                        field = ToCamelCase(firstError.PropertyName),
                        message = firstError.ErrorMessage,
                    });
                    return;
                }
            }

            await next();
        }

        private static string ToCamelCase(string propertyName)
        {
            if (string.IsNullOrEmpty(propertyName))
                return propertyName;

            return char.ToLowerInvariant(propertyName[0]) + propertyName[1..];
        }
    }
}
