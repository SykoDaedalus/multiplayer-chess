// Stockfish Engine Post-Game Analysis Module
(function (window) {
  let engineWorker = null;
  let isEngineReady = false;
  let currentCallback = null;

  const StockfishAnalysis = {
    init: function () {
      try {
        // Initialize Stockfish Web Worker
        const stockfishUrl = 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/stockfish.js';
        
        // Fetch worker script blob to prevent CORS worker restrictions
        fetch(stockfishUrl)
          .then(res => res.text())
          .then(code => {
            const blob = new Blob([code], { type: 'application/javascript' });
            engineWorker = new Worker(URL.createObjectURL(blob));

            engineWorker.onmessage = (e) => {
              const line = e.data;
              this.handleEngineOutput(line);
            };

            engineWorker.postMessage('uci');
            engineWorker.postMessage('isready');
          })
          .catch(err => {
            console.warn('Could not initialize Stockfish Web Worker, fallback evaluation active:', err);
          });
      } catch (err) {
        console.warn('Stockfish Worker init error:', err);
      }
    },

    handleEngineOutput: function (line) {
      if (typeof line !== 'string') return;

      if (line === 'readyok') {
        isEngineReady = true;
      }

      // Parse evaluation lines e.g. "info depth 12 score cp 145 nodes ..." or "info depth 10 score mate 3 ..."
      if (line.startsWith('info depth') && line.includes('score')) {
        let cpMatch = line.match(/score cp (-?\d+)/);
        let mateMatch = line.match(/score mate (-?\d+)/);

        if (cpMatch) {
          const centipawns = parseInt(cpMatch[1], 10);
          const scoreStr = (centipawns / 100).toFixed(1);
          const formatted = centipawns >= 0 ? `+${scoreStr}` : scoreStr;
          
          if (currentCallback) currentCallback({ type: 'cp', score: centipawns, formatted });
        } else if (mateMatch) {
          const mateIn = parseInt(mateMatch[1], 10);
          const formatted = mateIn >= 0 ? `M${mateIn}` : `-M${Math.abs(mateIn)}`;
          
          if (currentCallback) currentCallback({ type: 'mate', score: mateIn, formatted });
        }
      }
    },

    evaluatePosition: function (fen, depth = 12, callback) {
      currentCallback = callback;

      if (engineWorker && isEngineReady) {
        engineWorker.postMessage('stop');
        engineWorker.postMessage(`position fen ${fen}`);
        engineWorker.postMessage(`go depth ${depth}`);
      } else {
        // Fallback evaluation if worker not ready
        this.fallbackEvaluate(fen, callback);
      }
    },

    fallbackEvaluate: function (fen, callback) {
      // Basic piece count fallback evaluation
      const pieceValues = { p: -1, n: -3, b: -3, r: -5, q: -9, k: 0, P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
      const boardPart = fen.split(' ')[0];
      let total = 0;

      for (let char of boardPart) {
        if (pieceValues[char]) {
          total += pieceValues[char];
        }
      }

      const scoreStr = total >= 0 ? `+${total.toFixed(1)}` : total.toFixed(1);
      if (callback) {
        callback({ type: 'cp', score: total * 100, formatted: scoreStr });
      }
    },

    updateEvalBarUI: function (evalData, isFlipped = false) {
      const fillElement = document.getElementById('eval-bar-fill');
      const textElement = document.getElementById('eval-score-text');

      if (!fillElement || !textElement) return;

      textElement.innerText = evalData.formatted;

      let whitePercent = 50; // default equal

      if (evalData.type === 'cp') {
        const cp = evalData.score;
        // Sigmoid mapping for smooth bar height between -1000 and +1000 cp
        whitePercent = 50 + (50 * (2 / (1 + Math.exp(-0.003 * cp)) - 1));
      } else if (evalData.type === 'mate') {
        whitePercent = evalData.score > 0 ? 98 : 2;
      }

      // Clamp between 2% and 98%
      whitePercent = Math.max(2, Math.min(98, whitePercent));

      // Adjust height based on whether board is flipped (Black perspective)
      const fillHeight = isFlipped ? (100 - whitePercent) : whitePercent;
      fillElement.style.height = `${fillHeight}%`;

      if (fillHeight > 50) {
        fillElement.style.background = isFlipped ? '#2a2a2a' : '#ffffff';
      } else {
        fillElement.style.background = isFlipped ? '#ffffff' : '#2a2a2a';
      }
    }
  };

  window.StockfishAnalysis = StockfishAnalysis;
})(window);
