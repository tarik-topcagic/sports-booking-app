using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SportsBookingAPI.Migrations
{
    /// <inheritdoc />
    public partial class BackfillCityCantonId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // One-time backfill: match each existing City's legacy Canton string to a
            // Canton row by exact name. CantonId stays nullable here on purpose — a
            // separate, later migration (run only after every row is confirmed matched)
            // makes it NOT NULL.
            migrationBuilder.Sql(@"
                UPDATE ""Cities"" AS c
                SET ""CantonId"" = ct.""Id""
                FROM ""Cantons"" AS ct
                WHERE c.""Canton"" = ct.""Name""
                  AND c.""CantonId"" IS NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {

        }
    }
}
