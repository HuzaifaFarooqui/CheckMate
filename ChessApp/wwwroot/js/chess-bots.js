// Aether Chess Bot AI Systems

// Material evaluation weights
const PIECE_VALUES = {
    p: 100,
    n: 320,
    b: 330,
    r: 500,
    q: 900,
    k: 20000
};

// Piece-Square Tables (from White's perspective)
// Positional tables help the bot evaluate the quality of a square for each piece type.
const PST = {
    p: [
        [0,  0,  0,  0,  0,  0,  0,  0],
        [50, 50, 50, 50, 50, 50, 50, 50],
        [10, 10, 20, 30, 30, 20, 10, 10],
        [5,  5, 10, 25, 25, 10,  5,  5],
        [0,  0,  0, 20, 20,  0,  0,  0],
        [5, -5,-10,  0,  0,-10, -5,  5],
        [5, 10, 10,-20,-20, 10, 10,  5],
        [0,  0,  0,  0,  0,  0,  0,  0]
    ],
    n: [
        [-50,-40,-30,-30,-30,-30,-40,-50],
        [-40,-20,  0,  0,  0,  0,-20,-40],
        [-30,  0, 10, 15, 15, 10,  0,-30],
        [-30,  5, 15, 20, 20, 15,  5,-30],
        [-30,  0, 15, 20, 20, 15,  0,-30],
        [-30,  5, 10, 15, 15, 10,  5,-30],
        [-40,-20,  0,  5,  5,  0,-20,-40],
        [-50,-40,-30,-30,-30,-30,-40,-50]
    ],
    b: [
        [-20,-10,-10,-10,-10,-10,-10,-20],
        [-10,  0,  0,  0,  0,  0,  0,-10],
        [-10,  0,  5, 10, 10,  5,  0,-10],
        [-10,  5,  5, 10, 10,  5,  5,-10],
        [-10,  0, 10, 10, 10, 10,  0,-10],
        [-10, 10, 10, 10, 10, 10, 10,-10],
        [-10,  5,  0,  0,  0,  0,  5,-10],
        [-20,-10,-10,-10,-10,-10,-10,-20]
    ],
    r: [
        [0,  0,  0,  0,  0,  0,  0,  0],
        [5, 10, 10, 10, 10, 10, 10,  5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [0,  0,  0,  5,  5,  0,  0,  0]
    ],
    q: [
        [-20,-10,-10, -5, -5,-10,-10,-20],
        [-10,  0,  0,  0,  0,  0,  0,-10],
        [-10,  0,  5,  5,  5,  5,  0,-10],
        [-5,  0,  5,  5,  5,  5,  0, -5],
        [0,  0,  5,  5,  5,  5,  0, -5],
        [-10,  5,  5,  5,  5,  5,  0,-10],
        [-10,  0,  5,  0,  0,  5,  0,-10],
        [-20,-10,-10, -5, -5,-10,-10,-20]
    ],
    k: [
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-20,-30,-30,-40,-40,-30,-30,-20],
        [-10,-20,-20,-20,-20,-20,-20,-10],
        [20, 20,  0,  0,  0,  0, 20, 20],
        [20, 30, 10,  0,  0, 10, 30, 20]
    ]
};

// Helper: Check if a square on a board is attacked by any piece of attackerColor
function isSquareAttacked(row, col, attackerColor, board) {
    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece && piece.color === attackerColor) {
                // Generate pseudo-legal moves (basic sliding and stepping check)
                const moves = getSimplePseudoMoves(r, c, board);
                if (moves.some(m => m.r === row && m.c === col)) {
                    return true;
                }
            }
        }
    }
    return false;
}

// Helper: Is a piece defended by its own side?
// We simulate placing an opponent piece on that square, and see if any of our pieces can attack it.
function isSquareDefended(row, col, pieceColor, board) {
    const oppColor = pieceColor === 'w' ? 'b' : 'w';
    const tempBoard = board.map(r => r.slice());
    
    // Simulate placing opponent piece there
    tempBoard[row][col] = { type: 'p', color: oppColor };
    
    // Check if it's attacked by pieceColor
    return isSquareAttacked(row, col, pieceColor, tempBoard);
}

// Simple move generator for attack maps (to avoid recursion)
function getSimplePseudoMoves(r, c, board) {
    const piece = board[r][c];
    if (!piece) return [];
    
    const moves = [];
    const color = piece.color;
    const oppColor = color === 'w' ? 'b' : 'w';

    switch (piece.type) {
        case 'p':
            const dir = color === 'w' ? -1 : 1;
            // Pawn attacks are only diagonal
            for (const offset of [-1, 1]) {
                const targetCol = c + offset;
                if (targetCol >= 0 && targetCol < 8 && r + dir >= 0 && r + dir < 8) {
                    moves.push({ r: r + dir, c: targetCol });
                }
            }
            break;

        case 'n':
            const knightOffsets = [
                [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                [1, -2], [1, 2], [2, -1], [2, 1]
            ];
            for (const [dr, dc] of knightOffsets) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                    moves.push({ r: nr, c: nc });
                }
            }
            break;

        case 'b':
            addSlidingOffsets(r, c, [[-1, -1], [-1, 1], [1, -1], [1, 1]], board, moves);
            break;

        case 'r':
            addSlidingOffsets(r, c, [[-1, 0], [1, 0], [0, -1], [0, 1]], board, moves);
            break;

        case 'q':
            addSlidingOffsets(r, c, [
                [-1, -1], [-1, 1], [1, -1], [1, 1],
                [-1, 0], [1, 0], [0, -1], [0, 1]
            ], board, moves);
            break;

        case 'k':
            const kingOffsets = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1],           [0, 1],
                [1, -1],  [1, 0],  [1, 1]
            ];
            for (const [dr, dc] of kingOffsets) {
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                    moves.push({ r: nr, c: nc });
                }
            }
            break;
    }
    return moves;
}

function addSlidingOffsets(r, c, directions, board, moves) {
    for (const [dr, dc] of directions) {
        let nr = r + dr;
        let nc = c + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            moves.push({ r: nr, c: nc });
            if (board[nr][nc]) break; // Blocked
            nr += dr;
            nc += dc;
        }
    }
}

// Static Board Evaluation Function (Material + Position)
function evaluateBoard(board, botColor) {
    let score = 0;
    const oppColor = botColor === 'w' ? 'b' : 'w';

    for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
            const piece = board[r][c];
            if (piece) {
                // Get base value
                let val = PIECE_VALUES[piece.type];
                
                // Get positional table value (flip tables for black perspective)
                const tableRow = piece.color === 'w' ? r : 7 - r;
                const tableCol = piece.color === 'w' ? c : 7 - c;
                const posBonus = PST[piece.type][tableRow][tableCol];
                
                val += posBonus;

                // Add or subtract from total score
                if (piece.color === botColor) {
                    score += val;
                } else {
                    score -= val;
                }
            }
        }
    }
    return score;
}

// ----------------------------------------------------
// BOT 1: ASMEER (Weak-Intermediate)
// ----------------------------------------------------
function getAsmeerMove(engine) {
    const color = engine.activeColor;
    const oppColor = color === 'w' ? 'b' : 'w';
    const legalMoves = engine.getAllLegalMoves(color);

    if (legalMoves.length === 0) return null;

    // Center squares
    const centerSquares = [
        { r: 3, c: 3 }, { r: 3, c: 4 },
        { r: 4, c: 3 }, { r: 4, c: 4 }
    ];

    // Filter and score moves
    const ratedMoves = legalMoves.map(move => {
        let score = 0;
        const pieceType = move.piece;
        const targetPiece = engine.board[move.to.r][move.to.c];

        // 1. Prioritize captures
        if (targetPiece) {
            score += PIECE_VALUES[targetPiece.type] * 1.5;
        }

        // 2. Prefer center squares
        if (centerSquares.some(sq => sq.r === move.to.r && sq.c === move.to.c)) {
            score += 30; // center bonus
        }

        // 3. Avoid hanging pieces (simple heuristic)
        // Check if the target square is attacked by opponent
        const isAttacked = isSquareAttacked(move.to.r, move.to.c, oppColor, engine.board);
        if (isAttacked) {
            const isDefended = isSquareDefended(move.to.r, move.to.c, color, engine.board);
            if (!isDefended) {
                // Hanging! Deduct points proportional to the piece value
                score -= PIECE_VALUES[pieceType];
            } else if (PIECE_VALUES[pieceType] > (targetPiece ? PIECE_VALUES[targetPiece.type] : 0)) {
                // Defended but we put a high value piece on an attacked square
                score -= (PIECE_VALUES[pieceType] - (targetPiece ? PIECE_VALUES[targetPiece.type] : 0));
            }
        }

        return { move, score };
    });

    // Sort by score descending
    ratedMoves.sort((a, b) => b.score - a.score);

    // Group the best moves (within 15 points of the best score) and select semi-randomly
    const bestScore = ratedMoves[0].score;
    const candidates = ratedMoves.filter(m => m.score >= bestScore - 15);

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return chosen.move;
}

// ----------------------------------------------------
// BOT 2: FAWAD (Intermediate)
// ----------------------------------------------------
function getFawadMove(engine) {
    const color = engine.activeColor;
    const oppColor = color === 'w' ? 'b' : 'w';
    const legalMoves = engine.getAllLegalMoves(color);

    if (legalMoves.length === 0) return null;

    // We do a 1-ply search (look-ahead of 1 move) with blunder checking
    const scoredMoves = [];

    for (const move of legalMoves) {
        // Simulate move on a temporary board
        const tempBoard = engine.copyBoard(engine.board);
        const movingPiece = tempBoard[move.from.r][move.from.c];
        const targetPiece = tempBoard[move.to.r][move.to.c];

        // Apply move
        tempBoard[move.to.r][move.to.c] = movingPiece;
        tempBoard[move.from.r][move.from.c] = null;

        // Special capture logic for en passant
        if (movingPiece.type === 'p' && move.isEnPassant) {
            tempBoard[move.from.r][move.to.c] = null;
        }

        // 1. Static Evaluation of resulting position
        let moveScore = evaluateBoard(tempBoard, color);

        // 2. Capture priority
        if (targetPiece) {
            moveScore += PIECE_VALUES[targetPiece.type] * 2.0;
        }

        // 3. Blunder check: Check if the opponent can immediately capture this piece for free
        const isAttacked = isSquareAttacked(move.to.r, move.to.c, oppColor, tempBoard);
        if (isAttacked) {
            const isDefended = isSquareDefended(move.to.r, move.to.c, color, tempBoard);
            if (!isDefended) {
                moveScore -= PIECE_VALUES[movingPiece.type] * 2.5; // Heavy blunder penalty
            } else {
                // Defended, but check if we traded down
                const attackValue = PIECE_VALUES[movingPiece.type];
                const defendValue = targetPiece ? PIECE_VALUES[targetPiece.type] : 0;
                if (attackValue > defendValue) {
                    moveScore -= (attackValue - defendValue) * 1.5;
                }
            }
        }

        // 4. Blunder check: Check if this move allows the opponent to deliver an immediate checkmate
        // We simulate if the opponent has any move that delivers mate
        const oppMoves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const oppPiece = tempBoard[r][c];
                if (oppPiece && oppPiece.color === oppColor) {
                    // Get pseudo moves
                    const oppPseudo = getSimplePseudoMoves(r, c, tempBoard);
                    oppMoves.push(...oppPseudo.map(m => ({ from: { r, c }, to: { r: m.r, c: m.c } })));
                }
            }
        }

        let allowsMate = false;
        // Search if king is in check and has no escapes
        for (const oppMove of oppMoves) {
            const doubleTemp = tempBoard.map(row => row.map(cell => cell ? { ...cell } : null));
            doubleTemp[oppMove.to.r][oppMove.to.c] = doubleTemp[oppMove.from.r][oppMove.from.c];
            doubleTemp[oppMove.from.r][oppMove.from.c] = null;
            
            // Check if king of bot is in check after opponent's move
            let kr = -1, kc = -1;
            for (let r = 0; r < 8; r++) {
                for (let c = 0; c < 8; c++) {
                    const p = doubleTemp[r][c];
                    if (p && p.type === 'k' && p.color === color) {
                        kr = r; kc = c; break;
                    }
                }
                if (kr !== -1) break;
            }
            
            if (kr !== -1 && isSquareAttacked(kr, kc, oppColor, doubleTemp)) {
                // King is checked. Is it checkmate?
                // Simple approximation: if we allows immediate capture of our king, it's a critical threat
                if (oppMove.to.r === kr && oppMove.to.c === kc) {
                    allowsMate = true;
                    break;
                }
            }
        }

        if (allowsMate) {
            moveScore -= 50000; // Extreme penalty for allowing immediate mate
        }

        scoredMoves.push({ move, score: moveScore });
    }

    // Sort scored moves
    scoredMoves.sort((a, b) => b.score - a.score);

    // Take the best move
    return scoredMoves[0].move;
}

// ----------------------------------------------------
// BOT 3: HUXAIFA (Strongest - Minimax with Alpha-Beta)
// ----------------------------------------------------
function getHuzaifaMove(engine) {
    const color = engine.activeColor;
    const oppColor = color === 'w' ? 'b' : 'w';
    const legalMoves = engine.getAllLegalMoves(color);

    if (legalMoves.length === 0) return null;

    // Hardcoded Openings Check
    const moveCount = engine.history.length;
    
    // 1. Move 1: e2 -> e4 (White) or e7 -> e5 (Black)
    if (moveCount === 0 && color === 'w') {
        const e4Move = legalMoves.find(m => m.from.r === 6 && m.from.c === 4 && m.to.r === 4 && m.to.c === 4);
        if (e4Move) return e4Move;
    } else if (moveCount === 1 && color === 'b') {
        const e5Move = legalMoves.find(m => m.from.r === 1 && m.from.c === 4 && m.to.r === 3 && m.to.c === 4);
        if (e5Move) return e5Move;
    }

    // 2. Move 2: Queen to f3 (White) or Queen to f6 (Black)
    if (moveCount === 2 && color === 'w') {
        const qf3Move = legalMoves.find(m => m.piece === 'q' && m.to.r === 5 && m.to.c === 5);
        if (qf3Move) return qf3Move;
    } else if (moveCount === 3 && color === 'b') {
        const qf6Move = legalMoves.find(m => m.piece === 'q' && m.to.r === 2 && m.to.c === 5);
        if (qf6Move) return qf6Move;
    }

    // Run Minimax with Alpha-Beta pruning
    const searchDepth = 3; // depth 3 is safe and responsive (< 300ms)
    let bestMove = null;
    let bestScore = -Infinity;

    // Shuffle moves slightly to prevent playing identical games
    const shuffledMoves = legalMoves.slice().sort(() => Math.random() - 0.5);

    // Alpha-beta initial bounds
    let alpha = -Infinity;
    let beta = Infinity;

    for (const move of shuffledMoves) {
        // Play move
        const undoState = playSimulatedMove(engine, move);

        // Minimax evaluate (opponent is minimizing)
        const score = minimax(engine, searchDepth - 1, false, alpha, beta, color);

        // Undo move
        undoSimulatedMove(engine, undoState);

        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
        alpha = Math.max(alpha, score);
    }

    return bestMove;
}

// Minimax with Alpha-Beta pruning
function minimax(engine, depth, isMaximizing, alpha, beta, botColor) {
    const color = engine.activeColor;
    const oppColor = botColor === 'w' ? 'b' : 'w';

    // Base cases
    const status = engine.getGameStatus();
    if (status.isGameOver) {
        if (status.winner === (botColor === 'w' ? 'White' : 'Black')) {
            return 99999 + depth; // Favor quicker mate
        } else if (status.winner === (botColor === 'w' ? 'Black' : 'White')) {
            return -99999 - depth; // Avoid quicker mate
        } else {
            return 0; // Draw
        }
    }

    if (depth === 0) {
        return evaluateBoard(engine.board, botColor);
    }

    const legalMoves = engine.getAllLegalMoves(color);

    if (isMaximizing) {
        let maxScore = -Infinity;
        for (const move of legalMoves) {
            const undoState = playSimulatedMove(engine, move);
            const score = minimax(engine, depth - 1, false, alpha, beta, botColor);
            undoSimulatedMove(engine, undoState);
            maxScore = Math.max(maxScore, score);
            alpha = Math.max(alpha, score);
            if (beta <= alpha) break; // Prune
        }
        return maxScore;
    } else {
        let minScore = Infinity;
        for (const move of legalMoves) {
            const undoState = playSimulatedMove(engine, move);
            const score = minimax(engine, depth - 1, true, alpha, beta, botColor);
            undoSimulatedMove(engine, undoState);
            minScore = Math.min(minScore, score);
            beta = Math.min(beta, score);
            if (beta <= alpha) break; // Prune
        }
        return minScore;
    }
}

// Fast lightweight simulated movement for minimax
function playSimulatedMove(engine, move) {
    // Save relevant variables to restore
    const state = {
        board: engine.copyBoard(engine.board),
        castlingRights: JSON.parse(JSON.stringify(engine.castlingRights)),
        enPassantSquare: engine.enPassantSquare ? { ...engine.enPassantSquare } : null,
        activeColor: engine.activeColor,
        halfmoveClock: engine.halfmoveClock,
        fullmoveNumber: engine.fullmoveNumber
    };

    const fromRow = move.from.r;
    const fromCol = move.from.c;
    const toRow = move.to.r;
    const toCol = move.to.c;
    const piece = engine.board[fromRow][fromCol];

    // En Passant Capture
    if (piece.type === 'p' && move.isEnPassant) {
        engine.board[fromRow][toCol] = null;
    }

    // Castling
    if (piece.type === 'k' && move.isCastleKing) {
        const rook = engine.board[fromRow][7];
        engine.board[fromRow][5] = rook;
        engine.board[fromRow][7] = null;
    }
    if (piece.type === 'k' && move.isCastleQueen) {
        const rook = engine.board[fromRow][0];
        engine.board[fromRow][3] = rook;
        engine.board[fromRow][0] = null;
    }

    // Move Piece
    engine.board[toRow][toCol] = engine.board[fromRow][fromCol];
    engine.board[fromRow][fromCol] = null;

    // Promotion (assume Queen during simulation)
    if (piece.type === 'p' && (toRow === 0 || toRow === 7)) {
        engine.board[toRow][toCol] = { type: 'q', color: piece.color };
    }

    // Toggle turn
    engine.activeColor = engine.activeColor === 'w' ? 'b' : 'w';

    return state;
}

function undoSimulatedMove(engine, state) {
    engine.board = state.board;
    engine.castlingRights = state.castlingRights;
    engine.enPassantSquare = state.enPassantSquare;
    engine.activeColor = state.activeColor;
    engine.halfmoveClock = state.halfmoveClock;
    engine.fullmoveNumber = state.fullmoveNumber;
}

// ----------------------------------------------------
// BOT EXPORTED INTERFACE
// ----------------------------------------------------
const ChessBots = {
    makeBotMove: function(botName, engine) {
        switch (botName.toLowerCase()) {
            case 'asmeer':
                return getAsmeerMove(engine);
            case 'fawad':
                return getFawadMove(engine);
            case 'huzaifa':
                return getHuzaifaMove(engine);
            default:
                return null;
        }
    }
};
window.ChessBots = ChessBots;
