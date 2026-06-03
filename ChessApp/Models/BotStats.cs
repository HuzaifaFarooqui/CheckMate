using System;

namespace ChessApp.Models
{
    public class BotStats
    {
        public int Id { get; set; }
        public string BotName { get; set; } = null!; // "Asmeer", "Fawad", "Huzaifa"
        public int Wins { get; set; } = 0;
        public int Losses { get; set; } = 0;
        public int Draws { get; set; } = 0;
    }
}
