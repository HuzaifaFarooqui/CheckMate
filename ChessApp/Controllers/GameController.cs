using System;
using System.Linq;
using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using ChessApp.Data;
using ChessApp.Models;

namespace ChessApp.Controllers
{
    public class GameController : Controller
    {
        private readonly JsonDataStore _db;

        public GameController(JsonDataStore db)
        {
            _db = db;
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
        public IActionResult CreateGame(string opponentType)
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

            _db.AddGame(game);

            return Json(new { success = true, gameId = game.Id, fen = game.Fen, opponentType = game.OpponentType });
        }

        [HttpPost]
        public IActionResult SaveMove(int gameId, string moveText, string piece, string color, int moveNumber, string currentFen)
        {
            var game = _db.FindGameById(gameId);
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

            _db.AddMove(move);

            // Update game state
            game.Fen = currentFen;
            game.UpdatedAt = DateTime.UtcNow;
            _db.SaveChanges();

            return Json(new { success = true });
        }

        [HttpGet]
        public IActionResult GetGame(int gameId)
        {
            var game = _db.FindGameById(gameId);

            if (game == null)
            {
                return Json(new { success = false, message = "Game not found." });
            }

            var movesList = _db.GetMovesForGame(gameId)
                .Select(m => new {
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
        public IActionResult GetActiveGames()
        {
            int? userId = GetCurrentUserId();
            if (userId == null)
            {
                return Json(new { success = false, message = "Unauthorized." });
            }

            var activeGames = _db.GetActiveGamesForUser(userId.Value)
                .Select(g => new {
                    gameId = g.Id,
                    opponentType = g.OpponentType,
                    updatedAt = g.UpdatedAt.ToString("yyyy-MM-dd HH:mm:ss")
                })
                .ToList();

            return Json(new { success = true, games = activeGames });
        }

        [HttpPost]
        public IActionResult SaveGameStatus(int gameId, string winner, string status)
        {
            var game = _db.FindGameById(gameId);
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
                var botStat = _db.FindBotStatsByName(game.OpponentType);
                if (botStat != null)
                {
                    if (winner == "White") // White represents the User
                    {
                        botStat.Losses++;
                        if (userId != null)
                        {
                            var user = _db.FindUserById(userId.Value);
                            if (user != null) user.Wins++;
                        }
                    }
                    else if (winner == "Black") // Black represents the Bot
                    {
                        botStat.Wins++;
                        if (userId != null)
                        {
                            var user = _db.FindUserById(userId.Value);
                            if (user != null) user.Losses++;
                        }
                    }
                    else if (winner == "Draw")
                    {
                        botStat.Draws++;
                        if (userId != null)
                        {
                            var user = _db.FindUserById(userId.Value);
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

            _db.SaveChanges();

            return Json(new { success = true });
        }
    }
}
