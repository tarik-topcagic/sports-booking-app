using SportsBookingAPI.Interfaces;
using SportsBookingAPI.Models;

namespace SportsBookingAPI.Services
{
    public class ReservationReminderBackgroundService : BackgroundService
    {
        private static readonly TimeSpan TickInterval = TimeSpan.FromMinutes(1);

        private readonly IServiceScopeFactory _serviceScopeFactory;
        private readonly ILogger<ReservationReminderBackgroundService> _logger;

        public ReservationReminderBackgroundService(
            IServiceScopeFactory serviceScopeFactory,
            ILogger<ReservationReminderBackgroundService> logger)
        {
            _serviceScopeFactory = serviceScopeFactory;
            _logger = logger;
        }

        protected override async Task ExecuteAsync(CancellationToken stoppingToken)
        {
            using var timer = new PeriodicTimer(TickInterval);

            try
            {
                do
                {
                    try
                    {
                        await SendDueRemindersAsync(stoppingToken);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Error while processing reservation reminders.");
                    }
                }
                while (await timer.WaitForNextTickAsync(stoppingToken));
            }
            catch (OperationCanceledException)
            {
                // Expected when the host is shutting down -- PeriodicTimer.WaitForNextTickAsync
                // throws (rather than returning false) once the token is cancelled.
            }
        }

        private async Task SendDueRemindersAsync(CancellationToken cancellationToken)
        {
            using var scope = _serviceScopeFactory.CreateScope();
            var reservationRepository = scope.ServiceProvider.GetRequiredService<IReservationRepository>();
            var notificationRepository = scope.ServiceProvider.GetRequiredService<INotificationRepository>();
            var reservationNotificationService = scope.ServiceProvider.GetRequiredService<IReservationNotificationService>();

            var now = DateTime.UtcNow;

            await SendRemindersForWindowAsync(
                reservationRepository,
                notificationRepository,
                reservationNotificationService,
                now.AddMinutes(59),
                now.AddMinutes(61),
                AppNotificationType.ReservationReminder1Hour);

            await SendRemindersForWindowAsync(
                reservationRepository,
                notificationRepository,
                reservationNotificationService,
                now.AddMinutes(29),
                now.AddMinutes(31),
                AppNotificationType.ReservationReminder30Minutes);
        }

        private static async Task SendRemindersForWindowAsync(
            IReservationRepository reservationRepository,
            INotificationRepository notificationRepository,
            IReservationNotificationService reservationNotificationService,
            DateTime fromUtc,
            DateTime toUtc,
            AppNotificationType reminderType)
        {
            var dueReservations = await reservationRepository.GetConfirmedReservationsStartingBetweenAsync(fromUtc, toUtc);

            foreach (var reservation in dueReservations)
            {
                var alreadySent = await notificationRepository.ReservationReminderExistsAsync(reservation.Id, reminderType);
                if (alreadySent)
                    continue;

                await reservationNotificationService.CreateReservationReminderNotificationAsync(
                    reservation.UserId,
                    reservation.Id,
                    reminderType);
            }
        }
    }
}
