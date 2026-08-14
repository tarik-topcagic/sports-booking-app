using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SportsBookingAPI.Migrations
{
    /// <inheritdoc />
    public partial class RenameGradoviToCities : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameTable(
                name: "Gradovi",
                newName: "Cities");

            migrationBuilder.RenameColumn(
                name: "Naziv",
                table: "Cities",
                newName: "Name");

            migrationBuilder.RenameColumn(
                name: "Kanton",
                table: "Cities",
                newName: "Canton");

            migrationBuilder.Sql(
                "ALTER TABLE \"Cities\" RENAME CONSTRAINT \"PK_Gradovi\" TO \"PK_Cities\";");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                "ALTER TABLE \"Cities\" RENAME CONSTRAINT \"PK_Cities\" TO \"PK_Gradovi\";");

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "Cities",
                newName: "Naziv");

            migrationBuilder.RenameColumn(
                name: "Canton",
                table: "Cities",
                newName: "Kanton");

            migrationBuilder.RenameTable(
                name: "Cities",
                newName: "Gradovi");
        }
    }
}
