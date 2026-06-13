using System;
using System.Linq;
using Microsoft.AspNetCore.Mvc;
using ChessApp.Data;

namespace ChessApp.Controllers
{
    public class StatsController : Controller
    {
        private readonly JsonDataStore _db;

        public StatsController(JsonDataStore db)
        {
            _db = db;
        }

        [HttpGet]
        public IActionResult GetBotStats()
        {
            var stats = _db.BotStats
                .Select(b => new {
                    botName = b.BotName,
                    wins = b.Wins,
                    losses = b.Losses,
                    draws = b.Draws
                })
                .ToList();

            return Json(new { success = true, stats = stats });
        }

        [HttpGet]
        public IActionResult GetLeaderboard()
        {
            var leaderboard = _db.GetLeaderboard(10)
                .Select(u => new {
                    username = u.Username,
                    wins = u.Wins,
                    losses = u.Losses,
                    draws = u.Draws
                })
                .ToList();

            return Json(new { success = true, leaderboard = leaderboard });
        }
    }
}
