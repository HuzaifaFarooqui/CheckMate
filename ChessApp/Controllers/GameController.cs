using System;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ChessApp.Data;
using ChessApp.Models;

namespace ChessApp.Controllers
{
    public class GameController : Controller
    {
        private readonly ChessDbContext _context;

        public GameController(ChessDbContext context)
        {
            _context = context;
        }

        private int? GetCurrentUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            if (claim != null && int.TryParse(claim.Value, out int id))
            {
                return id;
            }
            return null;
        }

        [HttpPost]
        public async Task<IActionResult> CreateGame(string opponentType)
        {
            opponentType = string.IsNullOrWhiteSpace(opponentType) ? "LocalPlayer" : opponentType.Trim();
            int? userId = GetCurrentUserId();

            var game = new Game
            {
                UserId = userId,
                OpponentType = opponentType,
                Status = "Active",
                Winner = "None",
                Fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Games.Add(game);
            await _context.SaveChangesAsync();

            return Json(new { success = true, gameId = game.Id, fen = game.Fen, opponentType = game.OpponentType });
        }

        [HttpPost]
        public async Task<IActionResult> SaveMove(int gameId, string moveText, string piece, string color, int moveNumber, string currentFen)
        {
            var game = await _context.Games.FirstOrDefaultAsync(g => g.Id == gameId);
            if (game == null)
            {
                return Json(new { success = false, message = "Game not found." });
            }

            if (game.Status == "Completed")
            {
                return Json(new { success = false, message = "Game is already completed." });
            }

            var move = new Move
            {
                GameId = gameId,
                MoveText = moveText,
                Piece = piece,
                Color = color,
                MoveNumber = moveNumber,
                Timestamp = DateTime.UtcNow
            };

            _context.Moves.Add(move);

            // Update game state
            game.Fen = currentFen;
            game.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Json(new { success = true });
        }

        [HttpGet]
        public async Task<IActionResult> GetGame(int gameId)
        {
            var game = await _context.Games
                .Include(g => g.Moves)
                .FirstOrDefaultAsync(g => g.Id == gameId);

            if (game == null)
            {
                return Json(new { success = false, message = "Game not found." });
            }

            var movesList = game.Moves.OrderBy(m => m.MoveNumber).Select(m => new {
                m.MoveText,
                m.Piece,
                m.Color,
                m.MoveNumber
            }).ToList();

            return Json(new { 
                success = true, 
                gameId = game.Id, 
                fen = game.Fen, 
                opponentType = game.OpponentType, 
                status = game.Status,
                winner = game.Winner,
                moves = movesList
            });
        }

        [HttpGet]
        public async Task<IActionResult> GetActiveGames()
        {
            int? userId = GetCurrentUserId();
            if (userId == null)
            {
                return Json(new { success = false, message = "Unauthorized." });
            }

            var activeGames = await _context.Games
                .Where(g => g.UserId == userId && g.Status == "Active")
                .OrderByDescending(g => g.UpdatedAt)
                .Select(g => new {
                    gameId = g.Id,
                    opponentType = g.OpponentType,
                    updatedAt = g.UpdatedAt.ToString("yyyy-MM-dd HH:mm:ss")
                })
                .ToListAsync();

            return Json(new { success = true, games = activeGames });
        }

        [HttpPost]
        public async Task<IActionResult> SaveGameStatus(int gameId, string winner, string status)
        {
            var game = await _context.Games.FirstOrDefaultAsync(g => g.Id == gameId);
            if (game == null)
            {
                return Json(new { success = false, message = "Game not found." });
            }

            game.Status = status; // e.g. "Completed"
            game.Winner = winner; // "White", "Black", "Draw"
            game.UpdatedAt = DateTime.UtcNow;

            int? userId = game.UserId;
            
            // If it was a Player vs Bot game, update the statistics
            if (game.OpponentType != "LocalPlayer")
            {
                // Fetch the BotStats record
                var botStat = await _context.BotStats.FirstOrDefaultAsync(b => b.BotName.ToLower() == game.OpponentType.ToLower());
                if (botStat != null)
                {
                    if (winner == "White") // White represents the User
                    {
                        botStat.Losses++;
                        if (userId != null)
                        {
                            var user = await _context.Users.FindAsync(userId);
                            if (user != null) user.Wins++;
                        }
                    }
                    else if (winner == "Black") // Black represents the Bot
                    {
                        botStat.Wins++;
                        if (userId != null)
                        {
                            var user = await _context.Users.FindAsync(userId);
                            if (user != null) user.Losses++;
                        }
                    }
                    else if (winner == "Draw")
                    {
                        botStat.Draws++;
                        if (userId != null)
                        {
                            var user = await _context.Users.FindAsync(userId);
                            if (user != null) user.Draws++;
                        }
                    }
                }
            }
            else // Local PVP
            {
                if (userId != null)
                {
                    // For local PVP, we could log that the user played a local match, but usually we don't modify bot wins/losses.
                    // We can just increment Wins/Losses/Draws depending on which side they played or keep it as a friendly match.
                    // Let's keep User stats untouched for local PVP to avoid confusing credentials.
                }
            }

            await _context.SaveChangesAsync();

            return Json(new { success = true });
        }
    }
}
