using System;

namespace ChessApp.Models
{
    public class Move
    {
        public int Id { get; set; }
        public int GameId { get; set; }
        public string MoveText { get; set; } = null!; // E.g., "e2e4", "e7e5", "g1f3"
        public string Piece { get; set; } = null!; // "p", "r", "n", "b", "q", "k"
        public string Color { get; set; } = null!; // "w" or "b"
        public int MoveNumber { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
    }
}
