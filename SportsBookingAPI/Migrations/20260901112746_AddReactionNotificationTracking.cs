using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace SportsBookingAPI.Migrations
{
    /// <inheritdoc />
    public partial class AddReactionNotificationTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GroupMessageReactionNotifications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    GroupMessageId = table.Column<int>(type: "integer", nullable: false),
                    ReactorUserId = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupMessageReactionNotifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GroupMessageReactionNotifications_AspNetUsers_ReactorUserId",
                        column: x => x.ReactorUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_GroupMessageReactionNotifications_GroupMessages_GroupMessag~",
                        column: x => x.GroupMessageId,
                        principalTable: "GroupMessages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "PrivateMessageReactionNotifications",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PrivateMessageId = table.Column<int>(type: "integer", nullable: false),
                    ReactorUserId = table.Column<string>(type: "text", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PrivateMessageReactionNotifications", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PrivateMessageReactionNotifications_AspNetUsers_ReactorUser~",
                        column: x => x.ReactorUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_PrivateMessageReactionNotifications_PrivateMessages_Private~",
                        column: x => x.PrivateMessageId,
                        principalTable: "PrivateMessages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_GroupMessageReactionNotifications_GroupMessageId_ReactorUse~",
                table: "GroupMessageReactionNotifications",
                columns: new[] { "GroupMessageId", "ReactorUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GroupMessageReactionNotifications_ReactorUserId",
                table: "GroupMessageReactionNotifications",
                column: "ReactorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_PrivateMessageReactionNotifications_PrivateMessageId_Reacto~",
                table: "PrivateMessageReactionNotifications",
                columns: new[] { "PrivateMessageId", "ReactorUserId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PrivateMessageReactionNotifications_ReactorUserId",
                table: "PrivateMessageReactionNotifications",
                column: "ReactorUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "GroupMessageReactionNotifications");

            migrationBuilder.DropTable(
                name: "PrivateMessageReactionNotifications");
        }
    }
}
