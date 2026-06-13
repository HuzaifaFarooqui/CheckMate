using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using ChessApp.Models;

namespace ChessApp.Data
{
    /// <summary>
    /// A simple JSON file-based data store that replaces Entity Framework / SQL.
    /// All data is persisted to a single JSON file on disk.
    /// Thread-safe via lock for concurrent web requests.
    /// </summary>
    public class JsonDataStore
    {
        private readonly string _filePath;
        private readonly object _lock = new object();
        private DatabaseRoot _data;

        public JsonDataStore(string filePath = "App_Data/database.json")
        {
            _filePath = filePath;
            _data = new DatabaseRoot();
            LoadData();
            EnsureSeeded();
        }

        // ──────────────── Public Accessors ────────────────

        public List<User> Users
        {
            get { lock (_lock) return _data.Users; }
        }

        public List<Game> Games
        {
            get { lock (_lock) return _data.Games; }
        }

        public List<Move> Moves
        {
            get { lock (_lock) return _data.Moves; }
        }

        public List<BotStats> BotStats
        {
            get { lock (_lock) return _data.BotStats; }
        }

        // ──────────────── CRUD Helpers ────────────────

        // Users
        public User? FindUserById(int id)
        {
            lock (_lock) return _data.Users.FirstOrDefault(u => u.Id == id);
        }

        public User? FindUserByUsername(string username)
        {
            lock (_lock) return _data.Users.FirstOrDefault(
                u => u.Username.Equals(username, StringComparison.OrdinalIgnoreCase));
        }

        public bool UsernameExists(string username)
        {
            lock (_lock) return _data.Users.Any(
                u => u.Username.Equals(username, StringComparison.OrdinalIgnoreCase));
        }

        public User AddUser(User user)
        {
            lock (_lock)
            {
                user.Id = _data.NextUserId++;
                _data.Users.Add(user);
                SaveData();
                return user;
            }
        }

        // Games
        public Game? FindGameById(int id)
        {
            lock (_lock) return _data.Games.FirstOrDefault(g => g.Id == id);
        }

        public Game AddGame(Game game)
        {
            lock (_lock)
            {
                game.Id = _data.NextGameId++;
                _data.Games.Add(game);
                SaveData();
                return game;
            }
        }

        public List<Game> GetActiveGamesForUser(int userId)
        {
            lock (_lock) return _data.Games
                .Where(g => g.UserId == userId && g.Status == "Active")
                .OrderByDescending(g => g.UpdatedAt)
                .ToList();
        }

        // Moves
        public Move AddMove(Move move)
        {
            lock (_lock)
            {
                move.Id = _data.NextMoveId++;
                _data.Moves.Add(move);
                SaveData();
                return move;
            }
        }

        public List<Move> GetMovesForGame(int gameId)
        {
            lock (_lock) return _data.Moves
                .Where(m => m.GameId == gameId)
                .OrderBy(m => m.MoveNumber)
                .ToList();
        }

        // BotStats
        public BotStats? FindBotStatsByName(string botName)
        {
            lock (_lock) return _data.BotStats.FirstOrDefault(
                b => b.BotName.Equals(botName, StringComparison.OrdinalIgnoreCase));
        }

        // Leaderboard
        public List<User> GetLeaderboard(int top = 10)
        {
            lock (_lock) return _data.Users
                .OrderByDescending(u => u.Wins)
                .ThenBy(u => u.Losses)
                .Take(top)
                .ToList();
        }

        // ──────────────── Save ────────────────

        /// <summary>
        /// Persist all in-memory data to the JSON file.
        /// Call this after making any mutations.
        /// </summary>
        public void SaveChanges()
        {
            lock (_lock) SaveData();
        }

        // ──────────────── Internal ────────────────

        private void LoadData()
        {
            if (File.Exists(_filePath))
            {
                try
                {
                    var json = File.ReadAllText(_filePath);
                    _data = JsonSerializer.Deserialize<DatabaseRoot>(json) ?? new DatabaseRoot();
                }
                catch
                {
                    // If the file is corrupted, start fresh
                    _data = new DatabaseRoot();
                }
            }
        }

        private void SaveData()
        {
            var dir = Path.GetDirectoryName(_filePath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            {
                Directory.CreateDirectory(dir);
            }

            var options = new JsonSerializerOptions { WriteIndented = true };
            var json = JsonSerializer.Serialize(_data, options);
            File.WriteAllText(_filePath, json);
        }

        /// <summary>
        /// Seeds the three bot stats records if they don't exist yet.
        /// </summary>
        private void EnsureSeeded()
        {
            lock (_lock)
            {
                if (_data.BotStats.Count == 0)
                {
                    _data.BotStats.Add(new BotStats { Id = 1, BotName = "Asmeer", Wins = 0, Losses = 0, Draws = 0 });
                    _data.BotStats.Add(new BotStats { Id = 2, BotName = "Fawad", Wins = 0, Losses = 0, Draws = 0 });
                    _data.BotStats.Add(new BotStats { Id = 3, BotName = "Huzaifa", Wins = 0, Losses = 0, Draws = 0 });
                    _data.NextBotStatsId = 4;
                    SaveData();
                }
            }
        }
    }

    /// <summary>
    /// Root object that maps to the JSON file structure.
    /// </summary>
    internal class DatabaseRoot
    {
        public List<User> Users { get; set; } = new List<User>();
        public List<Game> Games { get; set; } = new List<Game>();
        public List<Move> Moves { get; set; } = new List<Move>();
        public List<BotStats> BotStats { get; set; } = new List<BotStats>();

        // Auto-increment counters
        public int NextUserId { get; set; } = 1;
        public int NextGameId { get; set; } = 1;
        public int NextMoveId { get; set; } = 1;
        public int NextBotStatsId { get; set; } = 1;
    }
}
