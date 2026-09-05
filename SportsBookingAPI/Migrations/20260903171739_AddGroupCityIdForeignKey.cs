using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SportsBookingAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddGroupCityIdForeignKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CityId",
                table: "Groups",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Groups_CityId",
                table: "Groups",
                column: "CityId");

            migrationBuilder.AddForeignKey(
                name: "FK_Groups_Cities_CityId",
                table: "Groups",
                column: "CityId",
                principalTable: "Cities",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // One-time backfill: match each existing Group's legacy City string to a City row by
            // exact name. Transitional — CityId stays nullable here; a separate, later migration
            // (run only after every row is confirmed matched) makes it NOT NULL and drops City.
            migrationBuilder.Sql(@"
                UPDATE ""Groups"" AS g
                SET ""CityId"" = c.""Id""
                FROM ""Cities"" AS c
                WHERE g.""City"" = c.""Name""
                  AND g.""CityId"" IS NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Groups_Cities_CityId",
                table: "Groups");

            migrationBuilder.DropIndex(
                name: "IX_Groups_CityId",
                table: "Groups");

            migrationBuilder.DropColumn(
                name: "CityId",
                table: "Groups");
        }
    }
}
