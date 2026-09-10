const { Chess } = require('chess.js');
const { dbQuery } = require('../config/database');

class GameManager {
  constructor() {
    this.rooms = new Map();
    this.matchmakingQueues = new Map();
  }

  parseTimeControl(preset) {
    const timeControlMap = {
      '1+0': { initialSeconds: 60, incrementSeconds: 0, label: '1 min Bullet' },
      '3+0': { initialSeconds: 180, incrementSeconds: 0, label: '3 min Blitz' },
      '5+3': { initialSeconds: 300, incrementSeconds: 3, label: '5+3 Blitz' },
      '10+0': { initialSeconds: 600, incrementSeconds: 0, label: '10 min Rapid' },
      '15+10': { initialSeconds: 900, incrementSeconds: 10, label: '15+10 Rapid' },
      'unlimited': { initialSeconds: 0, incrementSeconds: 0, label: 'Unlimited' }
    };
    return timeControlMap[preset] || timeControlMap['5+3'];
  }

  generateRoomId() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  createRoom(hostUser, timeControlPreset = '5+3', preferredColor = 'random', isPrivate = false) {
    let roomId = this.generateRoomId();
    while (this.rooms.has(roomId)) {
      roomId = this.generateRoomId();
    }

    const tc = this.parseTimeControl(timeControlPreset);
    let hostColor = preferredColor;
    if (preferredColor === 'random') {
      hostColor = Math.random() < 0.5 ? 'white' : 'black';
    }

    const room = {
      id: roomId,
      chess: new Chess(),
      timeControl: timeControlPreset,
      timeControlLabel: tc.label,
      initialMs: tc.initialSeconds * 1000,
      incrementMs: tc.incrementSeconds * 1000,
      isPrivate: isPrivate,
      white: hostColor === 'white' ? { ...hostUser } : null,
      black: hostColor === 'black' ? { ...hostUser } : null,
      whiteTimeMs: tc.initialSeconds * 1000,
      blackTimeMs: tc.initialSeconds * 1000,
      turn: 'white',
      gameStarted: false,
      gameOver: false,
      winner: null,
      resultReason: null,
      lastMoveTimestamp: null,
      timerInterval: null,
      spectators: [],
      drawOfferedBy: null,
      movesHistory: [],
      chatMessages: []
    };

    this.rooms.set(roomId, room);
    return room;
  }

  findOrCreateMatchmakingRoom(user, timeControlPreset, socketId) {
    const waitingRoomId = this.matchmakingQueues.get(timeControlPreset);

    if (waitingRoomId && this.rooms.has(waitingRoomId)) {
      const waitingRoom = this.rooms.get(waitingRoomId);
      const isWhiteHost = waitingRoom.white && waitingRoom.white.id === user.id;
      const isBlackHost = waitingRoom.black && waitingRoom.black.id === user.id;

      if (!waitingRoom.gameStarted && !waitingRoom.gameOver && !isWhiteHost && !isBlackHost) {
        this.matchmakingQueues.delete(timeControlPreset);
        const joinResult = this.joinRoom(waitingRoomId, user, socketId);
        return { room: waitingRoom, role: joinResult.role, isNew: false };
      }
    }

    const newRoom = this.createRoom(user, timeControlPreset, 'random', false);
    const joinResult = this.joinRoom(newRoom.id, user, socketId);
    this.matchmakingQueues.set(timeControlPreset, newRoom.id);

    return { room: newRoom, role: joinResult.role, isNew: true };
  }

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  joinRoom(roomId, user, socketId) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Room not found' };

    let role = 'spectator';
    const userId = user.id;

    if (room.white && room.white.id === userId) {
      room.white.socketId = socketId;
      role = 'white';
    } else if (room.black && room.black.id === userId) {
      room.black.socketId = socketId;
      role = 'black';
    } else if (!room.white) {
      room.white = { ...user, socketId };
      role = 'white';
    } else if (!room.black) {
      room.black = { ...user, socketId };
      role = 'black';
    } else {
      room.spectators.push({ ...user, socketId });
      role = 'spectator';
    }

    if (room.white && room.black && !room.gameStarted && !room.gameOver) {
      this.startGame(room);
    }

    return { room, role };
  }

  startGame(room) {
    room.gameStarted = true;
    room.lastMoveTimestamp = Date.now();

    if (room.initialMs > 0) {
      this.startClockTimer(room);
    }
  }

  startClockTimer(room) {
    if (room.timerInterval) clearInterval(room.timerInterval);

    room.timerInterval = setInterval(() => {
      if (!room.gameStarted || room.gameOver) {
        clearInterval(room.timerInterval);
        return;
      }

      const now = Date.now();
      const elapsed = now - room.lastMoveTimestamp;
      room.lastMoveTimestamp = now;

      if (room.turn === 'white') {
        room.whiteTimeMs = Math.max(0, room.whiteTimeMs - elapsed);
        if (room.whiteTimeMs <= 0) {
          this.endGame(room, 'black', 'timeout');
        }
      } else {
        room.blackTimeMs = Math.max(0, room.blackTimeMs - elapsed);
        if (room.blackTimeMs <= 0) {
          this.endGame(room, 'white', 'timeout');
        }
      }
    }, 100);
  }

  makeMove(roomId, user, moveData) {
    const room = this.rooms.get(roomId);
    if (!room) return { error: 'Room not found' };
    if (!room.gameStarted) return { error: 'Game has not started yet. Waiting for opponent.' };
    if (room.gameOver) return { error: 'Game is already over' };

    const isWhiteTurn = room.chess.turn() === 'w';
    const activePlayer = isWhiteTurn ? room.white : room.black;

    if (!activePlayer || activePlayer.id !== user.id) {
      return { error: 'It is not your turn' };
    }

    const now = Date.now();
    if (room.initialMs > 0 && room.lastMoveTimestamp) {
      const elapsed = now - room.lastMoveTimestamp;
      if (isWhiteTurn) {
        room.whiteTimeMs = Math.max(0, room.whiteTimeMs - elapsed + room.incrementMs);
      } else {
        room.blackTimeMs = Math.max(0, room.blackTimeMs - elapsed + room.incrementMs);
      }
    }
    room.lastMoveTimestamp = now;

    let moveObj = null;
    try {
      moveObj = room.chess.move({
        from: moveData.from,
        to: moveData.to,
        promotion: moveData.promotion || 'q'
      });
    } catch (e) {
      return { error: 'Illegal move' };
    }

    if (!moveObj) {
      return { error: 'Illegal move' };
    }

    room.movesHistory.push({
      from: moveObj.from,
      to: moveObj.to,
      san: moveObj.san,
      color: moveObj.color,
      piece: moveObj.piece,
      captured: moveObj.captured || null,
      fen: room.chess.fen()
    });

    room.turn = room.chess.turn() === 'w' ? 'white' : 'black';
    room.drawOfferedBy = null;

    if (room.chess.in_checkmate()) {
      const winnerColor = room.chess.turn() === 'w' ? 'black' : 'white';
      this.endGame(room, winnerColor, 'checkmate');
    } else if (room.chess.in_draw()) {
      let reason = 'draw';
      if (room.chess.in_stalemate()) reason = 'stalemate';
      else if (room.chess.in_threefold_repetition()) reason = 'threefold_repetition';
      else if (room.chess.insufficient_material()) reason = 'insufficient_material';
      this.endGame(room, 'draw', reason);
    }

    return { success: true, room, moveObj };
  }

  resign(roomId, user) {
    const room = this.rooms.get(roomId);
    if (!room || room.gameOver) return { error: 'Invalid room' };

    let winnerColor = null;
    if (room.white?.id === user.id) winnerColor = 'black';
    else if (room.black?.id === user.id) winnerColor = 'white';
    else return { error: 'You are not an active player in this match' };

    this.endGame(room, winnerColor, 'resignation');
    return { success: true, room };
  }

  abortGuestGameOnAuthChange(roomId, guestUserId) {
    const room = this.rooms.get(roomId);
    if (!room || room.gameOver || !room.gameStarted) return null;

    let winnerColor = null;
    if (room.white && room.white.id === guestUserId) {
      winnerColor = 'black';
    } else if (room.black && room.black.id === guestUserId) {
      winnerColor = 'white';
    }

    if (winnerColor) {
      this.endGame(room, winnerColor, 'abandonment');
      return { room, winner: winnerColor };
    }
    return null;
  }

  offerDraw(roomId, user) {
    const room = this.rooms.get(roomId);
    if (!room || room.gameOver) return { error: 'Invalid room' };

    const playerColor = room.white?.id === user.id ? 'white' : room.black?.id === user.id ? 'black' : null;
    if (!playerColor) return { error: 'You are not a player in this room' };

    room.drawOfferedBy = playerColor;
    return { success: true, room };
  }

  declineDraw(roomId, user) {
    const room = this.rooms.get(roomId);
    if (!room || room.gameOver) return { error: 'Invalid room' };

    room.drawOfferedBy = null;
    return { success: true, room };
  }

  acceptDraw(roomId, user) {
    const room = this.rooms.get(roomId);
    if (!room || room.gameOver) return { error: 'Invalid room' };
    if (!room.drawOfferedBy) return { error: 'No draw offer active' };

    const playerColor = room.white?.id === user.id ? 'white' : room.black?.id === user.id ? 'black' : null;
    if (playerColor === room.drawOfferedBy) return { error: 'Cannot accept your own draw offer' };

    this.endGame(room, 'draw', 'agreement');
    return { success: true, room };
  }

  async endGame(room, winner, reason) {
    room.gameOver = true;
    room.winner = winner;
    room.resultReason = reason;

    if (room.timerInterval) {
      clearInterval(room.timerInterval);
      room.timerInterval = null;
    }

    try {
      await dbQuery.saveGame({
        roomId: room.id,
        whitePlayerId: room.white?.dbId || null,
        blackPlayerId: room.black?.dbId || null,
        whiteUsername: room.white?.username || 'White Player',
        blackUsername: room.black?.username || 'Black Player',
        winner: winner,
        resultReason: reason,
        timeControl: room.timeControlLabel,
        pgn: room.chess.pgn(),
        fen: room.chess.fen()
      });
    } catch (err) {
      console.error('Failed to save game:', err);
    }
  }

  getPublicRoomState(room) {
    return {
      id: room.id,
      timeControl: room.timeControl,
      timeControlLabel: room.timeControlLabel,
      white: room.white ? { id: room.white.id, username: room.white.username } : null,
      black: room.black ? { id: room.black.id, username: room.black.username } : null,
      turn: room.turn,
      fen: room.chess.fen(),
      pgn: room.chess.pgn(),
      inCheck: room.chess.in_check(),
      gameStarted: room.gameStarted,
      gameOver: room.gameOver,
      winner: room.winner,
      resultReason: room.resultReason,
      whiteTimeMs: room.whiteTimeMs,
      blackTimeMs: room.blackTimeMs,
      drawOfferedBy: room.drawOfferedBy,
      movesHistory: room.movesHistory,
      chatMessages: room.chatMessages
    };
  }
}

module.exports = new GameManager();
