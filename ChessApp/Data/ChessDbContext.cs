using Microsoft.EntityFrameworkCore;
using ChessApp.Models;

namespace ChessApp.Data
{
    public class ChessDbContext : DbContext
    {
        public ChessDbContext(DbContextOptions<ChessDbContext> options) : base(options)
        {
        }

        public DbSet<User> Users { get; set; } = null!;
        public DbSet<Game> Games { get; set; } = null!;
        public DbSet<Move> Moves { get; set; } = null!;
        public DbSet<BotStats> BotStats { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure relationships and cascading deletes
            modelBuilder.Entity<Game>()
                .HasOne(g => g.User)
                .WithMany(u => u.Games)
                .HasForeignKey(g => g.UserId)
                .OnDelete(DeleteBehavior.SetNull);

            modelBuilder.Entity<Move>()
                .HasOne(m => m.Game)
                .WithMany(g => g.Moves)
                .HasForeignKey(m => m.GameId)
                .OnDelete(DeleteBehavior.Cascade);

            // Seed global statistics for our three bots
            modelBuilder.Entity<BotStats>().HasData(
                new BotStats { Id = 1, BotName = "Asmeer", Wins = 0, Losses = 0, Draws = 0 },
                new BotStats { Id = 2, BotName = "Fawad", Wins = 0, Losses = 0, Draws = 0 },
                new BotStats { Id = 3, BotName = "Huzaifa", Wins = 0, Losses = 0, Draws = 0 }
            );
        }
    }
}
