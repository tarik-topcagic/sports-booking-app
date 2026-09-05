using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SportsBookingAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddArenaCityIdForeignKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CityId",
                table: "Arenas",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Arenas_CityId",
                table: "Arenas",
                column: "CityId");

            migrationBuilder.AddForeignKey(
                name: "FK_Arenas_Cities_CityId",
                table: "Arenas",
                column: "CityId",
                principalTable: "Cities",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            // One-time backfill: match each existing Arena's legacy City string to a City row by
            // exact name. This is a transitional migration — CityId stays nullable here on
            // purpose. A separate, later migration (run only after every row is confirmed
            // matched) makes CityId NOT NULL and drops the City column entirely.
            migrationBuilder.Sql(@"
                UPDATE ""Arenas"" AS a
                SET ""CityId"" = c.""Id""
                FROM ""Cities"" AS c
                WHERE a.""City"" = c.""Name""
                  AND a.""CityId"" IS NULL;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Arenas_Cities_CityId",
                table: "Arenas");

            migrationBuilder.DropIndex(
                name: "IX_Arenas_CityId",
                table: "Arenas");

            migrationBuilder.DropColumn(
                name: "CityId",
                table: "Arenas");
        }
    }
}
