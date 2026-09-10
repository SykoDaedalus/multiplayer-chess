const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-chess-jwt-key-change-in-production-2026';

// HTTP Express Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Socket.io Auth Middleware
const authenticateSocket = (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;

  if (!token) {
    // Unique guest ID per socket connection
    const guestId = `guest_${socket.id}`;
    socket.user = { id: guestId, dbId: null, username: `Guest_${socket.id.substring(0, 4)}`, isGuest: true };
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      const guestId = `guest_${socket.id}`;
      socket.user = { id: guestId, dbId: null, username: `Guest_${socket.id.substring(0, 4)}`, isGuest: true };
    } else {
      socket.user = { id: `user_${decoded.id}`, dbId: decoded.id, username: decoded.username, isGuest: false };
    }
    next();
  });
};

module.exports = { authenticateToken, authenticateSocket, JWT_SECRET };
