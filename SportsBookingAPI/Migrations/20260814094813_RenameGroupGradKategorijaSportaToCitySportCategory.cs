using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SportsBookingAPI.Migrations
{
    /// <inheritdoc />
    public partial class RenameGroupGradKategorijaSportaToCitySportCategory : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "KategorijaSporta",
                table: "Groups",
                newName: "SportCategory");

            migrationBuilder.RenameColumn(
                name: "Grad",
                table: "Groups",
                newName: "City");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "SportCategory",
                table: "Groups",
                newName: "KategorijaSporta");

            migrationBuilder.RenameColumn(
                name: "City",
                table: "Groups",
                newName: "Grad");
        }
    }
}
