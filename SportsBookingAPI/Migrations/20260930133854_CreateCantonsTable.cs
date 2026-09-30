using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SportsBookingAPI.Migrations
{
    /// <inheritdoc />
    public partial class CreateCantonsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Cantons",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Name = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Cantons", x => x.Id);
                });

            // Seed order: the 10 FBiH cantons in their official numbered order, then
            // Republika Srpska, then Brčko Distrikt. The first five string values below
            // ('Kanton Sarajevo', 'Hercegovačko-neretvanski kanton', 'Tuzlanski kanton',
            // 'Zeničko-dobojski kanton', 'Unsko-sanski kanton', 'Republika Srpska') are
            // copied EXACTLY from the free-text values already used by existing Cities
            // rows (see SeedCitiesAndBackfillArenaCityId) so the later backfill migration
            // can match them by an exact string comparison — do not reformat these for
            // consistency, an unmatched backfill row is worse than inconsistent casing.
            // INSERT ... SELECT ... FROM (VALUES ...) does not guarantee the target
            // IDENTITY column is assigned in VALUES list order unless the SELECT itself
            // is explicitly ordered — an unordered version of this insert was verified
            // (via a real run against the dev database) to scramble the Id sequence
            // relative to the intended official order. The explicit ordinal + ORDER BY
            // here guarantees Id assignment follows the list below exactly.
            migrationBuilder.Sql(@"
                INSERT INTO ""Cantons"" (""Name"")
                SELECT v.""Name""
                FROM (VALUES
                    (1, 'Unsko-sanski kanton'),
                    (2, 'Posavski kanton'),
                    (3, 'Tuzlanski kanton'),
                    (4, 'Zeničko-dobojski kanton'),
                    (5, 'Bosansko-podrinjski kanton'),
                    (6, 'Srednjobosanski kanton'),
                    (7, 'Hercegovačko-neretvanski kanton'),
                    (8, 'Zapadnohercegovački kanton'),
                    (9, 'Kanton Sarajevo'),
                    (10, 'Livanjski kanton'),
                    (11, 'Republika Srpska'),
                    (12, 'Brčko Distrikt')
                ) AS v(""Ord"", ""Name"")
                WHERE NOT EXISTS (SELECT 1 FROM ""Cantons"" c WHERE c.""Name"" = v.""Name"")
                ORDER BY v.""Ord"";
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Cantons");
        }
    }
}
