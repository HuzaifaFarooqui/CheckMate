using System;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ChessApp.Data;

namespace ChessApp.Controllers
{
    public class StatsController : Controller
    {
        private readonly ChessDbContext _context;

        public StatsController(ChessDbContext context)
        {
            _context = context;
        }

        [HttpGet]
        public async Task<IActionResult> GetBotStats()
        {
            var stats = await _context.BotStats
                .Select(b => new {
                    botName = b.BotName,
                    wins = b.Wins,
                    losses = b.Losses,
                    draws = b.Draws
                })
                .ToListAsync();

            return Json(new { success = true, stats = stats });
        }

        [HttpGet]
        public async Task<IActionResult> GetLeaderboard()
        {
            var leaderboard = await _context.Users
                .OrderByDescending(u => u.Wins)
                .ThenBy(u => u.Losses)
                .Take(10)
                .Select(u => new {
                    username = u.Username,
                    wins = u.Wins,
                    losses = u.Losses,
                    draws = u.Draws
                })
                .ToListAsync();

            return Json(new { success = true, leaderboard = leaderboard });
        }
    }
}
