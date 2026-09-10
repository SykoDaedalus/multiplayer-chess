require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const gameRoutes = require('./routes/gameRoutes');
const { authenticateSocket } = require('./middleware/authMiddleware');
const { setupSocketHandlers } = require('./services/socketService');

// Global crash protection against unhandled errors
process.on('uncaughtException', (err) => {
  console.error('⚠️ [CRITICAL] Uncaught Exception:', err.stack || err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);

// Socket.io Middleware & Handlers
io.use(authenticateSocket);
setupSocketHandlers(io);

// Catch-all route to serve SPA frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`♟️ Lichess-Style Multiplayer Chess Server running on port ${PORT}`);
  console.log(`🌍 Local Access: http://localhost:${PORT}`);
  console.log(`=================================================`);
});
