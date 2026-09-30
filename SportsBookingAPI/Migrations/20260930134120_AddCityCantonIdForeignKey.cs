using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SportsBookingAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddCityCantonIdForeignKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "CantonId",
                table: "Cities",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Cities_CantonId",
                table: "Cities",
                column: "CantonId");

            migrationBuilder.AddForeignKey(
                name: "FK_Cities_Cantons_CantonId",
                table: "Cities",
                column: "CantonId",
                principalTable: "Cantons",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Cities_Cantons_CantonId",
                table: "Cities");

            migrationBuilder.DropIndex(
                name: "IX_Cities_CantonId",
                table: "Cities");

            migrationBuilder.DropColumn(
                name: "CantonId",
                table: "Cities");
        }
    }
}
