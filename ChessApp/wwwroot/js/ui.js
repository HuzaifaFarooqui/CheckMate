// Aether Chess UI Handler - SPA Lobby & Game Over Modal Integration

document.addEventListener("DOMContentLoaded", () => {
    const game = new ChessEngine();
    let selectedSquare = null; // { r, c }
    let validTargets = []; // Array of { r, c }
    let gameId = null;
    let currentOpponent = "LocalPlayer";
    let isBotCalculating = false;
    let lastMove = null; // { from: {r,c}, to: {r,c} }
    let capturedWhite = [];
    let capturedBlack = [];
    let moveNumberCount = 1;

    // DOM Elements
    const lobbyView = document.getElementById("lobby-view");
    const gameView = document.getElementById("game-view");
    
    const boardEl = document.getElementById("chessboard");
    const turnDotEl = document.getElementById("turn-dot");
    const turnTextEl = document.getElementById("turn-text");
    const botStatusEl = document.getElementById("bot-status");
    const gameOppDisplay = document.getElementById("game-opp-display");
    
    const btnUndo = document.getElementById("btn-undo");
    const btnLeaveGame = document.getElementById("btn-leave-game");
    
    // Modal Elements
    const gameOverOverlay = document.getElementById("game-over-overlay");
    const modalGlowIcon = document.getElementById("modal-glow-icon");
    const modalOutcomeTitle = document.getElementById("modal-outcome-title");
    const modalOutcomeSubtitle = document.getElementById("modal-outcome-subtitle");
    const btnModalReplay = document.getElementById("btn-modal-replay");
    const btnModalHome = document.getElementById("btn-modal-home");

    const moveHistoryList = document.getElementById("move-history-list");
    const capturedWhiteList = document.getElementById("captured-white-list");
    const capturedBlackList = document.getElementById("captured-black-list");
    
    const botStatsBody = document.getElementById("bot-stats-body");
    const leaderboardBody = document.getElementById("leaderboard-body");
    const activeGamesList = document.getElementById("active-games-list");
    const modeCards = document.querySelectorAll(".mode-list-item[data-mode]");

    // Web Audio Synthesizer for Sound Effects
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    function playSound(type) {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        
        const now = audioCtx.currentTime;

        if (type === 'move') {
            osc.type = 'sine';
            osc.frequency.setValueAtTime(320, now);
            osc.frequency.exponentialRampToValueAtTime(160, now + 0.1);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'capture') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(60, now + 0.15);
            gain.gain.setValueAtTime(0.18, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
        } else if (type === 'check') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(440, now);
            osc.frequency.setValueAtTime(580, now + 0.08);
            gain.gain.setValueAtTime(0.08, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
            osc.start(now);
            osc.stop(now + 0.22);
        } else if (type === 'win') {
            osc.type = 'sine';
            const notes = [261.63, 329.63, 392.00, 523.25]; // C major
            notes.forEach((freq, idx) => {
                const noteOsc = audioCtx.createOscillator();
                const noteGain = audioCtx.createGain();
                noteOsc.type = 'sine';
                noteOsc.frequency.value = freq;
                noteOsc.connect(noteGain);
                noteGain.connect(audioCtx.destination);
                
                noteGain.gain.setValueAtTime(0, now);
                noteGain.gain.linearRampToValueAtTime(0.15, now + idx * 0.08);
                noteGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.35);
                
                noteOsc.start(now + idx * 0.08);
                noteOsc.stop(now + idx * 0.08 + 0.35);
            });
        }
    }

    // Classic Wikipedia Wikimedia SVGs
    const pieceImages = {
        wp: 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
        wn: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
        wb: 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
        wr: 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
        wq: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
        wk: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
        bp: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
        bn: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Chess_ndt45.svg',
        bb: 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
        br: 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
        bq: 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
        bk: 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg'
    };

    // Toggle View State
    function showLobby() {
        gameOverOverlay.classList.remove("active");
        gameView.classList.remove("active");
        lobbyView.classList.add("active");
        
        isBotCalculating = false;
        botStatusEl.textContent = "";
        
        refreshStats();
    }

    function showGame(mode) {
        currentOpponent = mode;
        
        // Display mode name
        let oppName = "Local PVP";
        if (mode === "Asmeer") oppName = "Asmeer Bot (Easy)";
        else if (mode === "Fawad") oppName = "Fawad Bot (Medium)";
        else if (mode === "Huzaifa") oppName = "Huzaifa Bot (Hard)";
        
        gameOppDisplay.textContent = `vs ${oppName}`;
        
        lobbyView.classList.remove("active");
        gameView.classList.add("active");
        gameOverOverlay.classList.remove("active");

        initializeNewGame();
    }

    // Render Chessboard
    function renderBoard() {
        boardEl.innerHTML = "";
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const cell = document.createElement("div");
                cell.className = `board-cell ${(r + c) % 2 === 0 ? "light" : "dark"}`;
                cell.dataset.row = r;
                cell.dataset.col = c;

                // Highlight last move
                if (lastMove && (
                    (lastMove.from.r === r && lastMove.from.c === c) ||
                    (lastMove.to.r === r && lastMove.to.c === c)
                )) {
                    cell.classList.add("last-move");
                }

                // Highlight selected cell
                if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
                    cell.classList.add("selected");
                }

                // Draw pieces
                const piece = game.board[r][c];
                if (piece) {
                    const key = `${piece.color}${piece.type}`;
                    if (pieceImages[key]) {
                        const img = document.createElement("img");
                        img.src = pieceImages[key];
                        img.className = "chess-piece";
                        img.alt = key;
                        cell.appendChild(img);
                    }
                }

                // Draw legal move indicators
                const isTarget = validTargets.some(t => t.r === r && t.c === c);
                if (isTarget) {
                    if (piece || (game.enPassantSquare && game.enPassantSquare.r === r && game.enPassantSquare.c === c)) {
                        // Capture target: show ring
                        const ring = document.createElement("div");
                        ring.className = "capture-ring";
                        cell.appendChild(ring);
                    } else {
                        // Move target: show dot
                        const dot = document.createElement("div");
                        dot.className = "move-dot";
                        cell.appendChild(dot);
                    }
                }

                // Click event
                cell.addEventListener("click", () => handleCellClick(r, c));
                boardEl.appendChild(cell);
            }
        }

        updateStatusUI();
    }

    // Cell Clicks
    function handleCellClick(r, c) {
        if (isBotCalculating) return;

        const piece = game.board[r][c];
        const isTarget = validTargets.some(t => t.r === r && t.c === c);

        if (isTarget && selectedSquare) {
            executeMove(selectedSquare.r, selectedSquare.c, r, c);
        } else if (piece && piece.color === game.activeColor) {
            selectedSquare = { r, c };
            validTargets = game.getLegalMoves(r, c).map(m => ({ r: m.r, c: m.c }));
            renderBoard();
        } else {
            selectedSquare = null;
            validTargets = [];
            renderBoard();
        }
    }

    // Execute Move
    function executeMove(fromR, fromC, toR, toC, promoPiece = 'q') {
        const piece = game.board[fromR][fromC];
        const sourcePos = `${String.fromCharCode(97 + fromC)}${8 - fromR}`;
        const targetPos = `${String.fromCharCode(97 + toC)}${8 - toR}`;
        const notationText = `${sourcePos}${targetPos}`;
        
        const result = game.makeMove(fromR, fromC, toR, toC, promoPiece);
        if (result) {
            lastMove = { from: { r: fromR, c: fromC }, to: { r: toR, c: toC } };
            
            if (result.isCapture) {
                playSound('capture');
            } else {
                playSound('move');
            }

            if (result.isCheck) {
                playSound('check');
            }

            selectedSquare = null;
            validTargets = [];
            
            updateCapturedList();
            renderBoard();
            recordMoveHistory(notationText, piece.type, piece.color);

            // Save move in Database
            if (gameId) {
                saveMoveToBackend(gameId, notationText, piece.type, piece.color, moveNumberCount, game.generateFen());
            }

            const status = game.getGameStatus();
            if (status.isGameOver) {
                endGame(status);
            } else {
                if (currentOpponent !== "LocalPlayer" && game.activeColor === 'b') {
                    triggerBotTurn();
                }
            }
        }
    }

    // Bot move executor
    function triggerBotTurn() {
        isBotCalculating = true;
        
        let botText = "";
        if (currentOpponent.toLowerCase() === "asmeer") botText = "Asmeer is thinking...";
        else if (currentOpponent.toLowerCase() === "fawad") botText = "Fawad is thinking...";
        else if (currentOpponent.toLowerCase() === "huzaifa") botText = "Huzaifa is thinking...";
        botStatusEl.textContent = botText;

        const delay = 700 + Math.random() * 800;
        
        setTimeout(() => {
            if (!isBotCalculating) return;

            const botMove = ChessBots.makeBotMove(currentOpponent, game);
            if (botMove) {
                const { from, to, piece } = botMove;
                const result = game.makeMove(from.r, from.c, to.r, to.c, 'q');
                if (result) {
                    lastMove = { from: { r: from.r, c: from.c }, to: { r: to.r, c: to.c } };
                    
                    if (result.isCapture) playSound('capture');
                    else playSound('move');

                    if (result.isCheck) playSound('check');

                    const sourcePos = `${String.fromCharCode(97 + from.c)}${8 - from.r}`;
                    const targetPos = `${String.fromCharCode(97 + to.c)}${8 - to.r}`;
                    const notationText = `${sourcePos}${targetPos}`;

                    updateCapturedList();
                    renderBoard();
                    recordMoveHistory(notationText, piece, 'b');

                    if (gameId) {
                        saveMoveToBackend(gameId, notationText, piece, 'b', moveNumberCount, game.generateFen());
                    }

                    const status = game.getGameStatus();
                    if (status.isGameOver) {
                        endGame(status);
                    }
                }
            }
            
            isBotCalculating = false;
            botStatusEl.textContent = "";
        }, delay);
    }

    // Record Move in history
    function recordMoveHistory(moveStr, piece, color) {
        const historyRows = moveHistoryList.querySelectorAll(".moves-row");
        const pLower = piece.toLowerCase();
        const pieceKey = `${color}${pLower}`;
        const pieceImgUrl = pieceImages[pieceKey];
        
        const fromSq = moveStr.substring(0, 2);
        const toSq = moveStr.substring(2, 4);
        const arrowNotation = `${fromSq} ➔ ${toSq}`;

        const imgHtml = `<img src="${pieceImgUrl}" class="history-piece-icon" alt="${pLower}" />`;
        const valHtml = `${imgHtml} <span class="history-move-text">${arrowNotation}</span>`;

        if (color === 'w') {
            const row = document.createElement("div");
            row.className = "moves-row";
            row.innerHTML = `
                <div class="move-num">${moveNumberCount}.</div>
                <div class="move-val w-move" data-move="${moveStr}">${valHtml}</div>
                <div class="move-val b-move"></div>
            `;
            moveHistoryList.appendChild(row);
            moveHistoryList.scrollTop = moveHistoryList.scrollHeight;
        } else {
            if (historyRows.length > 0) {
                const lastRow = historyRows[historyRows.length - 1];
                const blackCell = lastRow.querySelector(".b-move");
                if (blackCell) {
                    blackCell.innerHTML = valHtml;
                    blackCell.setAttribute("data-move", moveStr);
                }
            }
            moveNumberCount++;
        }
    }

    // Refresh captured pieces
    function updateCapturedList() {
        const startCounts = { p: 8, n: 2, b: 2, r: 2, q: 1 };
        const currentCounts = {
            w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
            b: { p: 0, n: 0, b: 0, r: 0, q: 0 }
        };

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = game.board[r][c];
                if (p && p.type !== 'k') {
                    currentCounts[p.color][p.type]++;
                }
            }
        }

        capturedBlack = [];
        for (const type in startCounts) {
            const capturedCount = startCounts[type] - currentCounts['b'][type];
            for (let i = 0; i < capturedCount; i++) {
                capturedBlack.push(type);
            }
        }

        capturedWhite = [];
        for (const type in startCounts) {
            const capturedCount = startCounts[type] - currentCounts['w'][type];
            for (let i = 0; i < capturedCount; i++) {
                capturedWhite.push(type);
            }
        }

        capturedWhiteList.innerHTML = capturedWhite.map(t => `<img src="${pieceImages['w' + t]}" class="captured-piece-img" alt="${t}" />`).join("");
        capturedBlackList.innerHTML = capturedBlack.map(t => `<img src="${pieceImages['b' + t]}" class="captured-piece-img" alt="${t}" />`).join("");
    }

    function updateStatusUI() {
        const color = game.activeColor;
        turnDotEl.className = `turn-dot ${color === 'b' ? 'black' : ''}`;
        turnTextEl.textContent = `${color === 'w' ? "White's Turn" : "Black's Turn"}`;
    }

    // Game Over Pop-Up Modal trigger
    function endGame(status) {
        playSound('win');
        
        let titleText = "DRAW";
        let subText = `Draw by ${status.reason}`;
        let icon = `<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>`;

        if (status.winner === 'White') {
            titleText = currentOpponent === "LocalPlayer" ? "VICTORY!" : "VICTORY!";
            subText = currentOpponent === "LocalPlayer" ? "White won by Checkmate" : "You defeated the bot by Checkmate!";
            icon = `<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"></circle><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"></polyline></svg>`;
        } else if (status.winner === 'Black') {
            titleText = currentOpponent === "LocalPlayer" ? "VICTORY!" : "DEFEAT";
            subText = currentOpponent === "LocalPlayer" ? "Black won by Checkmate" : "The bot won by Checkmate!";
            icon = `<svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--accent-red)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
        }

        // Set modal content
        modalGlowIcon.innerHTML = icon;
        modalOutcomeTitle.textContent = titleText;
        modalOutcomeSubtitle.textContent = subText;
        
        // Show modal overlay
        gameOverOverlay.classList.add("active");

        // Save status in DB
        if (gameId) {
            saveGameStatusToBackend(gameId, status.winner, "Completed");
        }
    }

    // ----------------------------------------------------
    // BACKEND API SYNC CLIENT
    // ----------------------------------------------------
    function initializeNewGame() {
        isBotCalculating = false;
        botStatusEl.textContent = "";
        game.reset();
        lastMove = null;
        selectedSquare = null;
        validTargets = [];
        capturedWhite = [];
        capturedBlack = [];
        moveNumberCount = 1;

        moveHistoryList.innerHTML = "";
        capturedWhiteList.innerHTML = "";
        capturedBlackList.innerHTML = "";

        gameOverOverlay.classList.remove("active");

        fetch(`/Game/CreateGame?opponentType=${currentOpponent}`, {
            method: "POST"
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                gameId = data.gameId;
                renderBoard();
                
                if (currentOpponent !== "LocalPlayer" && game.activeColor === 'b') {
                    triggerBotTurn();
                }
            } else {
                console.error("Error generating backend game record:", data.message);
                renderBoard();
            }
            refreshActiveGames();
        })
        .catch(err => {
            console.error("Network error:", err);
            gameId = null;
            renderBoard();
        });
    }

    function saveMoveToBackend(gId, moveText, piece, color, moveNum, currentFen) {
        const formData = new FormData();
        formData.append("gameId", gId);
        formData.append("moveText", moveText);
        formData.append("piece", piece);
        formData.append("color", color);
        formData.append("moveNumber", moveNum);
        formData.append("currentFen", currentFen);

        fetch("/Game/SaveMove", {
            method: "POST",
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (!data.success) console.error("SaveMove warning:", data.message);
        })
        .catch(err => console.error(err));
    }

    function saveGameStatusToBackend(gId, winnerColor, statusText) {
        const formData = new FormData();
        formData.append("gameId", gId);
        formData.append("winner", winnerColor);
        formData.append("status", statusText);

        fetch("/Game/SaveGameStatus", {
            method: "POST",
            body: formData
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) refreshStats();
        })
        .catch(err => console.error(err));
    }

    function refreshActiveGames() {
        if (!activeGamesList) return;

        fetch("/Game/GetActiveGames")
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                activeGamesList.innerHTML = "";
                if (data.games.length === 0) {
                    activeGamesList.innerHTML = `<div class="active-game-item"><span class="text-muted">No active games</span></div>`;
                    return;
                }

                data.games.forEach(g => {
                    const item = document.createElement("div");
                    item.className = "active-game-item";
                    item.innerHTML = `
                        <div class="active-game-info">
                            <span class="active-game-opp">vs ${g.opponentType}</span>
                            <span class="active-game-date">${g.updatedAt}</span>
                        </div>
                        <button class="btn btn-secondary btn-sm load-game-btn" data-id="${g.gameId}">Load</button>
                    `;
                    activeGamesList.appendChild(item);
                });

                activeGamesList.querySelectorAll(".load-game-btn").forEach(btn => {
                    btn.addEventListener("click", () => {
                        const id = btn.getAttribute("data-id");
                        loadGameFromBackend(id);
                    });
                });
            }
        })
        .catch(err => console.error(err));
    }

    function loadGameFromBackend(gId) {
        fetch(`/Game/GetGame?gameId=${gId}`)
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                gameId = data.gameId;
                currentOpponent = data.opponentType;
                
                // Show game state
                let oppName = "Local PVP";
                if (currentOpponent === "Asmeer") oppName = "Asmeer Bot (Easy)";
                else if (currentOpponent === "Fawad") oppName = "Fawad Bot (Medium)";
                else if (currentOpponent === "Huzaifa") oppName = "Huzaifa Bot (Hard)";
                gameOppDisplay.textContent = `vs ${oppName}`;
                
                lobbyView.classList.remove("active");
                gameView.classList.add("active");
                gameOverOverlay.classList.remove("active");

                game.reset();
                game.loadFen(data.fen);
                
                lastMove = null;
                moveHistoryList.innerHTML = "";
                moveNumberCount = 1;

                if (data.moves && data.moves.length > 0) {
                    data.moves.forEach(m => {
                        recordMoveHistory(m.moveText, m.piece, m.color);
                    });
                    
                    const lastM = data.moves[data.moves.length - 1];
                    const src = lastM.moveText.substring(0, 2);
                    const dest = lastM.moveText.substring(2, 4);
                    const fromC = src.charCodeAt(0) - 97;
                    const fromR = 8 - parseInt(src[1]);
                    const toC = dest.charCodeAt(0) - 97;
                    const toR = 8 - parseInt(dest[1]);
                    lastMove = { from: { r: fromR, c: fromC }, to: { r: toR, c: toC } };
                }

                selectedSquare = null;
                validTargets = [];
                isBotCalculating = false;
                botStatusEl.textContent = "";

                updateCapturedList();
                renderBoard();

                if (data.status === "Completed") {
                    const mockStatus = {
                        isGameOver: true,
                        winner: data.winner,
                        reason: "Finished match"
                    };
                    endGame(mockStatus);
                } else if (currentOpponent !== "LocalPlayer" && game.activeColor === 'b') {
                    triggerBotTurn();
                }
            }
        })
        .catch(err => console.error(err));
    }

    function refreshStats() {
        // Bot Stats
        fetch("/Stats/GetBotStats")
        .then(res => res.json())
        .then(data => {
            if (data.success && botStatsBody) {
                botStatsBody.innerHTML = "";
                data.stats.forEach(b => {
                    const row = document.createElement("tr");
                    row.innerHTML = `
                        <td><strong>${b.botName} Bot</strong></td>
                        <td>${b.wins}</td>
                        <td>${b.losses}</td>
                        <td>${b.draws}</td>
                    `;
                    botStatsBody.appendChild(row);
                });
            }
        })
        .catch(err => console.error(err));

        // Leaderboard
        fetch("/Stats/GetLeaderboard")
        .then(res => res.json())
        .then(data => {
            if (data.success && leaderboardBody) {
                leaderboardBody.innerHTML = "";
                if (data.leaderboard.length === 0) {
                    leaderboardBody.innerHTML = `<tr><td colspan="4" class="text-muted text-center">No scores logged yet</td></tr>`;
                    return;
                }

                data.leaderboard.forEach((u, index) => {
                    const row = document.createElement("tr");
                    row.innerHTML = `
                        <td><span class="rank-badge">${index + 1}</span></td>
                        <td><strong>${u.username}</strong></td>
                        <td>${u.wins}</td>
                        <td>${u.losses}</td>
                    `;
                    leaderboardBody.appendChild(row);
                });
            }
        })
        .catch(err => console.error(err));
    }

    // ----------------------------------------------------
    // INITIALIZATION & LISTENERS
    // ----------------------------------------------------

    // Mode Selector Cards click triggers
    modeCards.forEach(card => {
        card.addEventListener("click", () => {
            if (isBotCalculating) return;
            const mode = card.getAttribute("data-mode");
            showGame(mode);
        });
    });

    // Undo Click
    btnUndo.addEventListener("click", () => {
        if (isBotCalculating) return;

        let undos = currentOpponent === "LocalPlayer" ? 1 : 2;
        let success = false;
        
        for (let i = 0; i < undos; i++) {
            if (game.undo()) {
                success = true;
                const rows = moveHistoryList.querySelectorAll(".moves-row");
                if (rows.length > 0) {
                    const lastRow = rows[rows.length - 1];
                    if (currentOpponent === "LocalPlayer") {
                        const blackCell = lastRow.querySelector(".b-move");
                        if (blackCell && blackCell.getAttribute("data-move")) {
                            blackCell.innerHTML = "";
                            blackCell.removeAttribute("data-move");
                        } else {
                            lastRow.remove();
                            moveNumberCount = Math.max(1, moveNumberCount - 1);
                        }
                    } else {
                        lastRow.remove();
                        moveNumberCount = Math.max(1, moveNumberCount - 1);
                    }
                }
            }
        }

        if (success) {
            playSound('move');
            selectedSquare = null;
            validTargets = [];
            
            const rows = moveHistoryList.querySelectorAll(".moves-row");
            if (rows.length > 0) {
                const lastRow = rows[rows.length - 1];
                const blackCell = lastRow.querySelector(".b-move");
                const whiteCell = lastRow.querySelector(".w-move");
                let lastMoveText = "";
                if (blackCell && blackCell.getAttribute("data-move")) {
                    lastMoveText = blackCell.getAttribute("data-move");
                } else if (whiteCell) {
                    lastMoveText = whiteCell.getAttribute("data-move") || "";
                }

                if (lastMoveText && lastMoveText.length >= 4) {
                    const src = lastMoveText.substring(0, 2);
                    const dest = lastMoveText.substring(2, 4);
                    const fromC = src.charCodeAt(0) - 97;
                    const fromR = 8 - parseInt(src[1]);
                    const toC = dest.charCodeAt(0) - 97;
                    const toR = 8 - parseInt(dest[1]);
                    lastMove = { from: { r: fromR, c: fromC }, to: { r: toR, c: toC } };
                } else {
                    lastMove = null;
                }
            } else {
                lastMove = null;
            }

            botStatusEl.textContent = "";
            updateCapturedList();
            renderBoard();
        }
    });

    // Leave Game (Resign)
    btnLeaveGame.addEventListener("click", () => {
        if (confirm("Are you sure you want to resign and leave the match?")) {
            showLobby();
        }
    });

    // Modal Actions
    btnModalReplay.addEventListener("click", () => {
        initializeNewGame();
    });

    btnModalHome.addEventListener("click", () => {
        showLobby();
    });

    // Start by showing lobby view on launch
    showLobby();
});
