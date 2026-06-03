// Aether Chess Rule Engine

class ChessEngine {
    constructor() {
        this.reset();
    }

    reset() {
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
        this.activeColor = 'w';
        this.castlingRights = {
            w: { kingSide: true, queenSide: true },
            b: { kingSide: true, queenSide: true }
        };
        this.enPassantSquare = null; // { r, c }
        this.halfmoveClock = 0;
        this.fullmoveNumber = 1;
        this.history = []; // Stack of state objects for undoing
        this.loadFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    }

    // Deep copy of the board array
    copyBoard(board) {
        return board.map(row => row.map(cell => cell ? { ...cell } : null));
    }

    // Load state from FEN notation
    loadFen(fen) {
        const parts = fen.trim().split(/\s+/);
        const position = parts[0];
        this.activeColor = parts[1] || 'w';
        
        // Castling rights
        const castling = parts[2] || '-';
        this.castlingRights = {
            w: { kingSide: castling.includes('K'), queenSide: castling.includes('Q') },
            b: { kingSide: castling.includes('k'), queenSide: castling.includes('q') }
        };

        // En passant square
        const ep = parts[3] || '-';
        if (ep !== '-') {
            const col = ep.charCodeAt(0) - 97; // a = 0
            const row = 8 - parseInt(ep[1]); // 8 = 0
            this.enPassantSquare = { r: row, c: col };
        } else {
            this.enPassantSquare = null;
        }

        this.halfmoveClock = parseInt(parts[4] || '0');
        this.fullmoveNumber = parseInt(parts[5] || '1');

        // Parse board position
        const rows = position.split('/');
        for (let r = 0; r < 8; r++) {
            let c = 0;
            const rowStr = rows[r];
            for (let i = 0; i < rowStr.length; i++) {
                const char = rowStr[i];
                if (char >= '1' && char <= '8') {
                    const emptySpaces = parseInt(char);
                    for (let j = 0; j < emptySpaces; j++) {
                        this.board[r][c++] = null;
                    }
                } else {
                    const color = char === char.toUpperCase() ? 'w' : 'b';
                    const type = char.toLowerCase();
                    this.board[r][c++] = { type, color };
                }
            }
        }
    }

    // Generate FEN from current board state
    generateFen() {
        let fenRows = [];
        for (let r = 0; r < 8; r++) {
            let emptyCount = 0;
            let rowStr = "";
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece === null) {
                    emptyCount++;
                } else {
                    if (emptyCount > 0) {
                        rowStr += emptyCount;
                        emptyCount = 0;
                    }
                    const char = piece.type;
                    rowStr += piece.color === 'w' ? char.toUpperCase() : char.toLowerCase();
                }
            }
            if (emptyCount > 0) {
                rowStr += emptyCount;
            }
            fenRows.push(rowStr);
        }

        const position = fenRows.join('/');
        const activeColor = this.activeColor;

        // Castling rights
        let castling = "";
        if (this.castlingRights.w.kingSide) castling += 'K';
        if (this.castlingRights.w.queenSide) castling += 'Q';
        if (this.castlingRights.b.kingSide) castling += 'k';
        if (this.castlingRights.b.queenSide) castling += 'q';
        if (castling === "") castling = "-";

        // En passant
        let epStr = "-";
        if (this.enPassantSquare) {
            const file = String.fromCharCode(97 + this.enPassantSquare.c);
            const rank = 8 - this.enPassantSquare.r;
            epStr = `${file}${rank}`;
        }

        return `${position} ${activeColor} ${castling} ${epStr} ${this.halfmoveClock} ${this.fullmoveNumber}`;
    }

    // Get legal moves for a piece at (r, c)
    getLegalMoves(r, c) {
        const piece = this.board[r][c];
        if (!piece || piece.color !== this.activeColor) return [];

        const pseudoMoves = this.getPseudoLegalMoves(r, c, this.board);
        const legalMoves = [];

        for (const move of pseudoMoves) {
            if (this.isMoveSafe(r, c, move.r, move.c)) {
                legalMoves.push(move);
            }
        }

        // Add Castling moves if eligible
        if (piece.type === 'k') {
            const castlingMoves = this.getCastlingMoves(r, c);
            legalMoves.push(...castlingMoves);
        }

        return legalMoves;
    }

    // Returns true if making the move does not leave/put own king in check
    isMoveSafe(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        const color = piece.color;
        
        // Simulate move on a temporary board copy
        const tempBoard = this.copyBoard(this.board);
        const targetPiece = tempBoard[toRow][toCol];
        
        // Handle basic move
        tempBoard[toRow][toCol] = tempBoard[fromRow][fromCol];
        tempBoard[fromRow][fromCol] = null;
        
        // Handle En Passant simulation
        if (piece.type === 'p' && this.enPassantSquare && toRow === this.enPassantSquare.r && toCol === this.enPassantSquare.c) {
            const captureRow = fromRow; // pawn captured is on the same row
            tempBoard[captureRow][toCol] = null;
        }

        return !this.isKingInCheck(color, tempBoard);
    }

    // Check if the king of given color is in check
    isKingInCheck(color, board = this.board) {
        // Find king
        let kr = -1, kc = -1;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board[r][c];
                if (p && p.type === 'k' && p.color === color) {
                    kr = r;
                    kc = c;
                    break;
                }
            }
            if (kr !== -1) break;
        }

        if (kr === -1) return false; // Edge case (shouldn't happen in real game)

        // Check if any opponent piece can capture king
        const opponentColor = color === 'w' ? 'b' : 'w';
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board[r][c];
                if (p && p.color === opponentColor) {
                    const moves = this.getPseudoLegalMoves(r, c, board);
                    if (moves.some(m => m.r === kr && m.c === kc)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // Generate pseudo-legal moves (not checking for check/safety)
    getPseudoLegalMoves(r, c, board = this.board) {
        const piece = board[r][c];
        if (!piece) return [];

        const moves = [];
        const color = piece.color;
        const oppColor = color === 'w' ? 'b' : 'w';

        switch (piece.type) {
            case 'p':
                const dir = color === 'w' ? -1 : 1;
                const startRow = color === 'w' ? 6 : 1;

                // 1. Move 1 square forward
                if (r + dir >= 0 && r + dir < 8 && !board[r + dir][c]) {
                    moves.push({ r: r + dir, c: c });
                    // 2. Move 2 squares forward from starting row
                    if (r === startRow && !board[r + 2 * dir][c]) {
                        moves.push({ r: r + 2 * dir, c: c, isDoublePawnPush: true });
                    }
                }

                // 3. Diagonal captures
                for (const offset of [-1, 1]) {
                    const targetCol = c + offset;
                    if (targetCol >= 0 && targetCol < 8 && r + dir >= 0 && r + dir < 8) {
                        const targetPiece = board[r + dir][targetCol];
                        if (targetPiece && targetPiece.color === oppColor) {
                            moves.push({ r: r + dir, c: targetCol });
                        }
                        
                        // En Passant capture check
                        if (this.enPassantSquare && this.enPassantSquare.r === r + dir && this.enPassantSquare.c === targetCol) {
                            moves.push({ r: r + dir, c: targetCol, isEnPassant: true });
                        }
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
                        const target = board[nr][nc];
                        if (!target || target.color === oppColor) {
                            moves.push({ r: nr, c: nc });
                        }
                    }
                }
                break;

            case 'b':
                this.addSlidingMoves(r, c, [[-1, -1], [-1, 1], [1, -1], [1, 1]], board, oppColor, moves);
                break;

            case 'r':
                this.addSlidingMoves(r, c, [[-1, 0], [1, 0], [0, -1], [0, 1]], board, oppColor, moves);
                break;

            case 'q':
                this.addSlidingMoves(r, c, [
                    [-1, -1], [-1, 1], [1, -1], [1, 1],
                    [-1, 0], [1, 0], [0, -1], [0, 1]
                ], board, oppColor, moves);
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
                        const target = board[nr][nc];
                        if (!target || target.color === oppColor) {
                            moves.push({ r: nr, c: nc });
                        }
                    }
                }
                break;
        }

        return moves;
    }

    addSlidingMoves(r, c, directions, board, oppColor, moves) {
        for (const [dr, dc] of directions) {
            let nr = r + dr;
            let nc = c + dc;
            while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
                const target = board[nr][nc];
                if (!target) {
                    moves.push({ r: nr, c: nc });
                } else {
                    if (target.color === oppColor) {
                        moves.push({ r: nr, c: nc });
                    }
                    break; // Blocked by piece
                }
                nr += dr;
                nc += dc;
            }
        }
    }

    // Get Castling moves for King
    getCastlingMoves(r, c) {
        const moves = [];
        const color = this.activeColor;
        
        // Cannot castle if currently in check
        if (this.isKingInCheck(color)) return [];

        const rights = this.castlingRights[color];
        
        // King Side castling
        if (rights.kingSide) {
            const f1 = this.board[r][5];
            const g1 = this.board[r][6];
            if (!f1 && !g1) {
                // Path must be safe (squares f1 and g1 must not be attacked)
                if (this.isMoveSafe(r, c, r, 5) && this.isMoveSafe(r, c, r, 6)) {
                    moves.push({ r: r, c: 6, isCastleKing: true });
                }
            }
        }

        // Queen Side castling
        if (rights.queenSide) {
            const d1 = this.board[r][3];
            const c1 = this.board[r][2];
            const b1 = this.board[r][1];
            if (!d1 && !c1 && !b1) {
                // King moves through d1 and c1 (must be safe)
                if (this.isMoveSafe(r, c, r, 3) && this.isMoveSafe(r, c, r, 2)) {
                    moves.push({ r: r, c: 2, isCastleQueen: true });
                }
            }
        }

        return moves;
    }

    // Play a move on the board
    makeMove(fromRow, fromCol, toRow, toCol, targetPromo = 'q') {
        const piece = this.board[fromRow][fromCol];
        if (!piece) return false;

        const targetPiece = this.board[toRow][toCol];
        
        // Find if this is a special move type
        const legalMoves = this.getLegalMoves(fromRow, fromCol);
        const match = legalMoves.find(m => m.r === toRow && m.c === toCol);
        if (!match) return false; // Illegal move!

        // Push state to history for undo support
        this.history.push({
            board: this.copyBoard(this.board),
            castlingRights: JSON.parse(JSON.stringify(this.castlingRights)),
            enPassantSquare: this.enPassantSquare ? { ...this.enPassantSquare } : null,
            activeColor: this.activeColor,
            halfmoveClock: this.halfmoveClock,
            fullmoveNumber: this.fullmoveNumber
        });

        // 1. En Passant Capture logic
        let isCapture = targetPiece !== null;
        if (piece.type === 'p' && match.isEnPassant) {
            const captureRow = fromRow;
            this.board[captureRow][toCol] = null;
            isCapture = true;
        }

        // 2. Castling movement logic
        if (piece.type === 'k' && match.isCastleKing) {
            const rook = this.board[fromRow][7];
            this.board[fromRow][5] = rook;
            this.board[fromRow][7] = null;
        }
        if (piece.type === 'k' && match.isCastleQueen) {
            const rook = this.board[fromRow][0];
            this.board[fromRow][3] = rook;
            this.board[fromRow][0] = null;
        }

        // 3. Move the piece
        this.board[toRow][toCol] = this.board[fromRow][fromCol];
        this.board[fromRow][fromCol] = null;

        // 4. Pawn Promotion logic
        if (piece.type === 'p' && (toRow === 0 || toRow === 7)) {
            this.board[toRow][toCol] = { type: targetPromo, color: piece.color };
        }

        // 5. Update Castling Rights
        // If King moves
        if (piece.type === 'k') {
            this.castlingRights[piece.color].kingSide = false;
            this.castlingRights[piece.color].queenSide = false;
        }
        // If Rooks move or are captured
        if (piece.type === 'r') {
            if (fromRow === (piece.color === 'w' ? 7 : 0)) {
                if (fromCol === 7) this.castlingRights[piece.color].kingSide = false;
                if (fromCol === 0) this.castlingRights[piece.color].queenSide = false;
            }
        }
        if (targetPiece && targetPiece.type === 'r') {
            const oppColor = piece.color === 'w' ? 'b' : 'w';
            if (toRow === (oppColor === 'w' ? 7 : 0)) {
                if (toCol === 7) this.castlingRights[oppColor].kingSide = false;
                if (toCol === 0) this.castlingRights[oppColor].queenSide = false;
            }
        }

        // 6. Update En Passant Square
        if (piece.type === 'p' && match.isDoublePawnPush) {
            const dir = piece.color === 'w' ? -1 : 1;
            this.enPassantSquare = { r: fromRow + dir, c: fromCol };
        } else {
            this.enPassantSquare = null;
        }

        // 7. Update Clocks
        if (piece.type === 'p' || isCapture) {
            this.halfmoveClock = 0;
        } else {
            this.halfmoveClock++;
        }

        if (this.activeColor === 'b') {
            this.fullmoveNumber++;
        }

        // 8. Toggle Player Turn
        this.activeColor = this.activeColor === 'w' ? 'b' : 'w';
        
        return {
            isCapture,
            isCastling: match.isCastleKing || match.isCastleQueen,
            isCheck: this.isKingInCheck(this.activeColor)
        };
    }

    // Undo the last move
    undo() {
        if (this.history.length === 0) return false;
        const prevState = this.history.pop();
        this.board = prevState.board;
        this.castlingRights = prevState.castlingRights;
        this.enPassantSquare = prevState.enPassantSquare;
        this.activeColor = prevState.activeColor;
        this.halfmoveClock = prevState.halfmoveClock;
        this.fullmoveNumber = prevState.fullmoveNumber;
        return true;
    }

    // Get all legal moves for a given color
    getAllLegalMoves(color) {
        const moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === color) {
                    const legal = this.getLegalMoves(r, c);
                    for (const m of legal) {
                        moves.push({
                            from: { r, c },
                            to: { r: m.r, c: m.c },
                            piece: piece.type,
                            isCastleKing: m.isCastleKing,
                            isCastleQueen: m.isCastleQueen,
                            isEnPassant: m.isEnPassant
                        });
                    }
                }
            }
        }
        return moves;
    }

    // Check if the game is over
    getGameStatus() {
        const color = this.activeColor;
        const hasLegalMoves = this.getAllLegalMoves(color).length > 0;
        const inCheck = this.isKingInCheck(color);

        if (!hasLegalMoves) {
            if (inCheck) {
                return { isGameOver: true, winner: color === 'w' ? 'Black' : 'White', reason: 'Checkmate' };
            } else {
                return { isGameOver: true, winner: 'Draw', reason: 'Stalemate' };
            }
        }

        if (this.halfmoveClock >= 100) {
            return { isGameOver: true, winner: 'Draw', reason: '50-Move Rule' };
        }

        return { isGameOver: false, winner: 'None', reason: 'Active' };
    }
}
