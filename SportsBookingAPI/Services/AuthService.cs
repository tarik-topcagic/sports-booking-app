using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Services
{
    public class AuthService : IAuthService
    {
        private readonly UserManager<AppUser> _userManager;
        private readonly ITokenService _tokenService;

        public AuthService(
            UserManager<AppUser> userManager,
            ITokenService tokenService)
        {
            _userManager = userManager;
            _tokenService = tokenService;
        }

        public async Task<ServiceResult> RegisterAsync(RegisterModel model)
        {
            var existingUser = await _userManager.FindByNameAsync(model.Username);
            if (existingUser != null)
                return ServiceResult.BadRequest(new { field = "username", message = "Username is already taken." });

            var normalizedEmail = _userManager.NormalizeEmail(model.Email);
            var existingEmail = await _userManager.Users
                .AnyAsync(user => user.NormalizedEmail == normalizedEmail);
            if (existingEmail)
                return ServiceResult.BadRequest(new { field = "email", message = "Email is already in use." });

            var existingPhoneNumber = await _userManager.Users
                .AnyAsync(user => user.PhoneNumber == model.PhoneNumber);
            if (existingPhoneNumber)
                return ServiceResult.BadRequest(new { field = "phoneNumber", message = "Phone number is already in use." });

            var user = new AppUser
            {
                FullName = model.FullName,
                UserName = model.Username,
                Email = model.Email,
                PhoneNumber = model.PhoneNumber,
                CreatedAt = DateTime.UtcNow
            };

            var result = await _userManager.CreateAsync(user, model.Password);
            if (!result.Succeeded)
                return ServiceResult.BadRequest(result.Errors);

            return ServiceResult.Ok(new { message = "Registration successful" });
        }

        public async Task<ServiceResult> LoginAsync(LoginModel model)
        {
            var normalizedUsername = _userManager.NormalizeName(model.Username.Trim());
            var user = await _userManager.Users
                .SingleOrDefaultAsync(appUser => appUser.NormalizedUserName == normalizedUsername);

            if (user == null ||
                !string.Equals(user.UserName, model.Username.Trim(), StringComparison.Ordinal))
            {
                return new ServiceResult
                {
                    StatusCode = StatusCodes.Status401Unauthorized,
                    Payload = "Invalid login attempt"
                };
            }

            if (await _userManager.IsLockedOutAsync(user))
            {
                return new ServiceResult
                {
                    StatusCode = StatusCodes.Status401Unauthorized,
                    Payload = "Account is locked"
                };
            }

            if (!(await _userManager.CheckPasswordAsync(user, model.Password)))
            {
                return new ServiceResult
                {
                    StatusCode = StatusCodes.Status401Unauthorized,
                    Payload = "Invalid login attempt"
                };
            }

            var token = await _tokenService.GenerateJwtToken(user);

            return ServiceResult.Ok(new
            {
                Token = token,
                Username = user.UserName,
                FullName = user.FullName,
            });
        }
    }
}
