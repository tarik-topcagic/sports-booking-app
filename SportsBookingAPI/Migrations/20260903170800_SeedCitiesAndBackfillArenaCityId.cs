using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SportsBookingAPI.Migrations
{
    /// <inheritdoc />
    public partial class SeedCitiesAndBackfillArenaCityId : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(@"
                INSERT INTO ""Cities"" (""Name"", ""Canton"")
                SELECT v.""Name"", v.""Canton""
                FROM (VALUES
                    ('Sarajevo', 'Kanton Sarajevo'),
                    ('Mostar', 'Hercegovačko-neretvanski kanton'),
                    ('Tuzla', 'Tuzlanski kanton'),
                    ('Zenica', 'Zeničko-dobojski kanton'),
                    ('Bihać', 'Unsko-sanski kanton'),
                    ('Banja Luka', 'Republika Srpska'),
                    ('Velika Kladuša', 'Unsko-sanski kanton')
                ) AS v(""Name"", ""Canton"")
                WHERE NOT EXISTS (SELECT 1 FROM ""Cities"" c WHERE c.""Name"" = v.""Name"");
            ");

            migrationBuilder.Sql(@"
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'Arenas' AND column_name = 'City'
                    ) THEN
                        UPDATE ""Arenas"" a
                        SET ""CityId"" = c.""Id""
                        FROM ""Cities"" c
                        WHERE c.""Name"" = a.""City""
                          AND a.""CityId"" IS NULL;
                    END IF;
                END $$;
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            
        }
    }
}
