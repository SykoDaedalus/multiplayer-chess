// Interactive Chessboard & Game Mechanics Engine
(function (window) {
  let board = null;
  let game = new Chess();
  let currentRoomState = null;
  let playerRole = 'spectator';
  let currentRoomId = null;
  let pendingMove = null;

  // Analysis state
  let analysisMoveIndex = -1;
  let isAnalysisMode = false;

  // Sound Synth using Web Audio API
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  
  function playSound(type) {
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;

      if (type === 'move') {
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + 0.08);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
        osc.start(now);
        osc.stop(now + 0.08);
      } else if (type === 'capture') {
        osc.frequency.setValueAtTime(250, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.12);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
        osc.start(now);
        osc.stop(now + 0.12);
      } else if (type === 'check') {
        osc.frequency.setValueAtTime(600, now);
        osc.frequency.setValueAtTime(800, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else if (type === 'gameover') {
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.15);
        osc.frequency.setValueAtTime(783.99, now + 0.3);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (e) {}
  }

  let clockInterval = null;

  const ChessGame = {
    init: function () {
      const config = {
        draggable: true,
        position: 'start',
        onDragStart: this.onDragStart.bind(this),
        onDrop: this.onDrop.bind(this),
        onSnapEnd: this.onSnapEnd.bind(this),
        pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png'
      };

      board = Chessboard('chessboard', config);
      $(window).resize(() => this.resizeBoard());

      this.bindUIEvents();
      StockfishAnalysis.init();
      this.resizeBoard();
    },

    resizeBoard: function () {
      setTimeout(() => {
        if (board) {
          board.resize();
          if (currentRoomState && currentRoomState.fen) {
            board.position(currentRoomState.fen);
          }
        }
      }, 50);
    },

    getPlayerRole: function () {
      return playerRole;
    },

    bindUIEvents: function () {
      document.querySelectorAll('.promo-choice').forEach(el => {
        el.addEventListener('click', (e) => {
          const promoPiece = e.target.getAttribute('data-piece');
          document.getElementById('modal-promotion').classList.remove('active');

          if (pendingMove) {
            this.executeMove(pendingMove.from, pendingMove.to, promoPiece);
            pendingMove = null;
          }
        });
      });

      document.getElementById('btn-move-first')?.addEventListener('click', () => this.navigateAnalysis(0));
      document.getElementById('btn-move-prev')?.addEventListener('click', () => this.navigateAnalysis(analysisMoveIndex - 1));
      document.getElementById('btn-move-next')?.addEventListener('click', () => this.navigateAnalysis(analysisMoveIndex + 1));
      document.getElementById('btn-move-last')?.addEventListener('click', () => this.navigateAnalysis(currentRoomState?.movesHistory?.length - 1));
    },

    setRoomData: function (roomId, role, roomState) {
      currentRoomId = roomId;
      playerRole = role;
      currentRoomState = roomState;
      isAnalysisMode = false;
      analysisMoveIndex = -1;

      game.load(roomState.fen);

      if (playerRole === 'black') {
        board.orientation('black');
      } else {
        board.orientation('white');
      }

      this.resizeBoard();
      this.updateUI(roomState);
    },

    onDragStart: function (source, piece) {
      if (!currentRoomState || !currentRoomState.gameStarted || currentRoomState.gameOver || isAnalysisMode) {
        return false;
      }

      if (playerRole !== 'white' && playerRole !== 'black') {
        return false;
      }

      const isWhiteTurn = game.turn() === 'w';
      if ((isWhiteTurn && playerRole !== 'white') || (!isWhiteTurn && playerRole !== 'black')) {
        return false;
      }

      if ((isWhiteTurn && piece.search(/^b/) !== -1) || (!isWhiteTurn && piece.search(/^w/) !== -1)) {
        return false;
      }

      return true;
    },

    onDrop: function (source, target) {
      if (source === target) return 'snapback';

      const piece = game.get(source);
      const isPawnPromotion = (
        piece && piece.type === 'p' &&
        ((piece.color === 'w' && target.charAt(1) === '8') || (piece.color === 'b' && target.charAt(1) === '1'))
      );

      const possibleMove = game.move({
        from: source,
        to: target,
        promotion: 'q'
      });

      if (possibleMove === null) {
        return 'snapback';
      }

      game.undo();

      if (isPawnPromotion) {
        pendingMove = { from: source, to: target };
        document.getElementById('modal-promotion').classList.add('active');
        return;
      }

      this.executeMove(source, target, 'q');
    },

    executeMove: function (from, to, promotion) {
      SocketClient.makeMove({
        roomId: currentRoomId,
        from,
        to,
        promotion
      }, (response) => {
        if (response.error) {
          alert('Illegal move: ' + response.error);
          board.position(game.fen());
        }
      });
    },

    onSnapEnd: function () {
      board.position(game.fen());
    },

    handleMoveMade: function (moveData) {
      const { move, state } = moveData;
      currentRoomState = state;
      game.load(state.fen);
      board.position(state.fen);

      if (move.captured) {
        playSound('capture');
      } else if (state.inCheck) {
        playSound('check');
      } else {
        playSound('move');
      }

      this.updateUI(state);
    },

    handleGameOver: function (data) {
      const { winner, reason, state } = data;
      currentRoomState = state;
      playSound('gameover');

      this.updateUI(state);
      this.activatePostGameAnalysis(state);
    },

    updateUI: function (state) {
      const gameLayout = document.getElementById('game-layout');
      if (state.gameOver) {
        gameLayout.classList.add('game-over-active');
      } else {
        gameLayout.classList.remove('game-over-active');
      }

      this.updateClocks(state);

      const isBlackPlayer = playerRole === 'black';

      const userObj = isBlackPlayer ? state.black : state.white;
      const oppObj = isBlackPlayer ? state.white : state.black;

      document.getElementById('user-name-board').innerText = userObj ? userObj.username : (isBlackPlayer ? 'Black' : 'White');
      document.getElementById('user-avatar').innerText = isBlackPlayer ? 'B' : 'W';

      document.getElementById('opponent-name').innerText = oppObj ? oppObj.username : 'Waiting for opponent...';
      document.getElementById('opponent-avatar').innerText = isBlackPlayer ? 'W' : 'B';

      this.renderMoveList(state.movesHistory);

      const banner = document.getElementById('game-status-banner');
      banner.className = 'game-status-banner';

      if (state.gameOver) {
        banner.classList.add('active', 'banner-ended');
        if (state.winner === 'draw') {
          banner.innerText = `🤝 Game Drawn (${state.resultReason})`;
        } else {
          const winnerName = state.winner === 'white' ? (state.white?.username || 'White') : (state.black?.username || 'Black');
          banner.innerText = `🏆 ${winnerName} won (${state.resultReason})!`;
        }
      } else if (state.gameStarted && state.inCheck) {
        banner.classList.add('active', 'banner-check');
        banner.innerText = `⚠️ Check!`;
      } else if (!state.gameStarted) {
        banner.classList.add('active', 'banner-check');
        banner.innerText = `⏳ Waiting for opponent to join... Share room code or invite link!`;
      } else {
        banner.style.display = 'none';
      }

      const isPlayer = playerRole === 'white' || playerRole === 'black';
      document.getElementById('btn-offer-draw').style.display = isPlayer && !state.gameOver && state.gameStarted ? 'inline-flex' : 'none';
      document.getElementById('btn-resign').style.display = isPlayer && !state.gameOver && state.gameStarted ? 'inline-flex' : 'none';
      document.getElementById('btn-rematch').style.display = isPlayer && state.gameOver ? 'inline-flex' : 'none';
    },

    updateClocks: function (state) {
      if (clockInterval) clearInterval(clockInterval);

      let wMs = state.whiteTimeMs;
      let bMs = state.blackTimeMs;

      const formatTime = (ms) => {
        if (ms <= 0) return '00:00';
        const totalSec = Math.floor(ms / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      };

      const render = () => {
        const isBlackPerspective = playerRole === 'black';

        const userMs = isBlackPerspective ? bMs : wMs;
        const oppMs = isBlackPerspective ? wMs : bMs;

        const isWhiteTurn = state.turn === 'white';
        const isUserTurn = (isBlackPerspective && !isWhiteTurn) || (!isBlackPerspective && isWhiteTurn);

        const userClockEl = document.getElementById('user-clock');
        const oppClockEl = document.getElementById('opponent-clock');

        userClockEl.innerText = formatTime(userMs);
        oppClockEl.innerText = formatTime(oppMs);

        if (state.gameStarted && !state.gameOver) {
          userClockEl.classList.toggle('active-turn', isUserTurn);
          oppClockEl.classList.toggle('active-turn', !isUserTurn);
        } else {
          userClockEl.classList.remove('active-turn');
          oppClockEl.classList.remove('active-turn');
        }

        userClockEl.classList.toggle('low-time', userMs < 30000 && userMs > 0);
        oppClockEl.classList.toggle('low-time', oppMs < 30000 && oppMs > 0);
      };

      render();

      if (state.gameStarted && !state.gameOver && state.whiteTimeMs > 0 && state.blackTimeMs > 0) {
        clockInterval = setInterval(() => {
          if (state.turn === 'white') wMs = Math.max(0, wMs - 1000);
          else bMs = Math.max(0, bMs - 1000);
          render();
        }, 1000);
      }
    },

    renderMoveList: function (moves) {
      const container = document.getElementById('moves-list');
      container.innerHTML = '';

      if (!moves || moves.length === 0) {
        container.innerHTML = '<div style="grid-column: 1 / -1; color: var(--text-muted); text-align: center; padding: 0.5rem;">No moves yet</div>';
        return;
      }

      for (let i = 0; i < moves.length; i += 2) {
        const moveNum = Math.floor(i / 2) + 1;
        const whiteMove = moves[i];
        const blackMove = moves[i + 1];

        const numCell = document.createElement('div');
        numCell.className = 'move-cell';
        numCell.innerText = `${moveNum}.`;

        const wCell = document.createElement('div');
        wCell.className = `move-cell ${analysisMoveIndex === i ? 'active' : ''}`;
        wCell.innerText = whiteMove.san;
        wCell.addEventListener('click', () => this.navigateAnalysis(i));

        const bCell = document.createElement('div');
        bCell.className = `move-cell ${analysisMoveIndex === i + 1 ? 'active' : ''}`;
        bCell.innerText = blackMove ? blackMove.san : '';
        if (blackMove) {
          bCell.addEventListener('click', () => this.navigateAnalysis(i + 1));
        }

        container.appendChild(numCell);
        container.appendChild(wCell);
        container.appendChild(bCell);
      }

      container.scrollTop = container.scrollHeight;
    },

    activatePostGameAnalysis: function (state) {
      isAnalysisMode = true;
      const gameLayout = document.getElementById('game-layout');
      gameLayout.classList.add('game-over-active');
      
      this.navigateAnalysis(state.movesHistory.length - 1);
    },

    navigateAnalysis: function (index) {
      if (!currentRoomState || !currentRoomState.movesHistory) return;
      const history = currentRoomState.movesHistory;

      if (index < 0) index = 0;
      if (index >= history.length) index = history.length - 1;

      analysisMoveIndex = index;
      const targetMove = history[index];

      if (targetMove) {
        game.load(targetMove.fen);
        board.position(targetMove.fen);

        this.renderMoveList(history);

        StockfishAnalysis.evaluatePosition(targetMove.fen, 12, (evalData) => {
          StockfishAnalysis.updateEvalBarUI(evalData, playerRole === 'black');
        });
      }
    }
  };

  window.ChessGame = ChessGame;
})(window);
