using System;
using System.Collections.Generic;

namespace ChessApp.Models
{
    public class Game
    {
        public int Id { get; set; }
        public int? UserId { get; set; }
        public User? User { get; set; }
        public string OpponentType { get; set; } = "LocalPlayer"; // "LocalPlayer", "Asmeer", "Fawad", "Huzaifa"
        public string Status { get; set; } = "Active"; // "Active", "Completed"
        public string Winner { get; set; } = "None"; // "White", "Black", "Draw", "None"
        public string Fen { get; set; } = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"; // Standard starting FEN
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

        public List<Move> Moves { get; set; } = new();
    }
}
