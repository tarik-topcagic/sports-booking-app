namespace SportsBookingAPI.Helpers
{
    public static class UploadPathHelper
    {
        private const string DefaultUploadsPath = "wwwroot/uploads";

        public static string GetUploadsBasePath(IConfiguration configuration)
        {
            var configuredPath = configuration["UploadsPath"];
            var basePath = string.IsNullOrWhiteSpace(configuredPath) ? DefaultUploadsPath : configuredPath;

            return Path.Combine(Directory.GetCurrentDirectory(), basePath);
        }

        public static string GetUploadsSubfolder(IConfiguration configuration, string subfolder)
        {
            return Path.Combine(GetUploadsBasePath(configuration), subfolder);
        }
    }
}
