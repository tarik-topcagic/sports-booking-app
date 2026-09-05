using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SportsBookingAPI.Migrations
{
    /// <inheritdoc />
    public partial class MakeArenaCityIdRequired : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Arenas_City_SportType",
                table: "Arenas");

            migrationBuilder.DropIndex(
                name: "IX_Arenas_CityId",
                table: "Arenas");

            migrationBuilder.DropColumn(
                name: "City",
                table: "Arenas");

            migrationBuilder.AlterColumn<int>(
                name: "CityId",
                table: "Arenas",
                type: "integer",
                nullable: false,
                defaultValue: 0,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Arenas_CityId_SportType",
                table: "Arenas",
                columns: new[] { "CityId", "SportType" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Arenas_CityId_SportType",
                table: "Arenas");

            migrationBuilder.AlterColumn<int>(
                name: "CityId",
                table: "Arenas",
                type: "integer",
                nullable: true,
                oldClrType: typeof(int),
                oldType: "integer");

            migrationBuilder.AddColumn<string>(
                name: "City",
                table: "Arenas",
                type: "character varying(80)",
                maxLength: 80,
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "IX_Arenas_City_SportType",
                table: "Arenas",
                columns: new[] { "City", "SportType" });

            migrationBuilder.CreateIndex(
                name: "IX_Arenas_CityId",
                table: "Arenas",
                column: "CityId");
        }
    }
}
