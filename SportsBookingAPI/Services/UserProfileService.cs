using Microsoft.AspNetCore.Http;
using SportsBookingAPI.DTOs;
using SportsBookingAPI.Helpers;
using SportsBookingAPI.Interfaces;

namespace SportsBookingAPI.Services
{
    public class UserProfileService : IUserProfileService
    {
        private readonly IUserRepository _userRepository;
        private readonly IConfiguration _configuration;

        public UserProfileService(IUserRepository userRepository, IConfiguration configuration)
        {
            _userRepository = userRepository;
            _configuration = configuration;
        }

        public async Task<ServiceResult> UpdateProfileAsync(string userId, UpdateProfileDto updateProfileDto)
        {
            var user = await _userRepository.GetUserByIdAsync(userId);
            if (user == null)
                return ServiceResult.NotFound();

            user.FullName = updateProfileDto.FullName;
            user.ProfilePictureUrl = updateProfileDto.ProfilePictureUrl ?? "default-profile.png";
            user.PhoneNumber = updateProfileDto.PhoneNumber;
            user.Location = updateProfileDto.Location;

            var result = await _userRepository.UpdateUserAsync(user);
            if (!result.Succeeded)
                return ServiceResult.BadRequest(result.Errors);

            return ServiceResult.Ok(result);
        }

        public async Task<ServiceResult> UploadProfilePictureAsync(UpdateProfilePictureDto updateProfilePictureDto, string scheme, HostString host)
        {
            if (updateProfilePictureDto.File == null || updateProfilePictureDto.File.Length == 0)
                return ServiceResult.BadRequest("No image selected.");

            var uploadsFolder = UploadPathHelper.GetUploadsSubfolder(_configuration, "profile");
            if (!Directory.Exists(uploadsFolder))
                Directory.CreateDirectory(uploadsFolder);

            var fileName = Guid.NewGuid().ToString() + Path.GetExtension(updateProfilePictureDto.File.FileName);
            var filePath = Path.Combine(uploadsFolder, fileName);

            using (var stream = new FileStream(filePath, FileMode.Create))
            {
                await updateProfilePictureDto.File.CopyToAsync(stream);
            }

            var imageUrl = $"{scheme}://{host}/uploads/profile/{fileName}";
            return ServiceResult.Ok(new { imageUrl });
        }

        public async Task<ServiceResult> DeleteProfilePictureAsync(string userId)
        {
            var user = await _userRepository.GetUserByIdAsync(userId);
            if (user == null)
                return ServiceResult.NotFound();

            if (!string.IsNullOrEmpty(user.ProfilePictureUrl) &&
                user.ProfilePictureUrl.ToLower() != "default-profile.png")
            {
                var uri = new Uri(user.ProfilePictureUrl);
                var fileName = Path.GetFileName(uri.AbsolutePath);
                var filePath = Path.Combine(UploadPathHelper.GetUploadsSubfolder(_configuration, "profile"), fileName);

                if (System.IO.File.Exists(filePath))
                {
                    System.IO.File.Delete(filePath);
                }
            }

            user.ProfilePictureUrl = "default-profile.png";
            var result = await _userRepository.UpdateUserAsync(user);

            return result.Succeeded ? ServiceResult.Ok() : ServiceResult.BadRequest(result.Errors);
        }
    }
}
