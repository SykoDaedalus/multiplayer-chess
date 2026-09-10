const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/chess_db';

let isConnected = false;

// Connect to MongoDB
mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 5000
})
.then(() => {
  isConnected = true;
  console.log('✅ Connected to MongoDB successfully at:', MONGODB_URI);
})
.catch((err) => {
  console.warn('⚠️ MongoDB connection warning (Falling back to in-memory store until MongoDB connects):', err.message);
});

// User Schema
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, trim: true, lowercase: true },
  password_hash: { type: String, required: true },
  rating: { type: Number, default: 1200 },
  wins: { type: Number, default: 0 },
  losses: { type: Number, default: 0 },
  draws: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Game Schema
const gameSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  whitePlayerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  blackPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  whiteUsername: { type: String, required: true },
  blackUsername: { type: String, required: true },
  winner: { type: String, required: true }, // 'white', 'black', 'draw'
  resultReason: { type: String, required: true },
  timeControl: { type: String, required: true },
  pgn: { type: String, default: '' },
  fen: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Game = mongoose.model('Game', gameSchema);

// In-Memory Fallback Cache when MongoDB server is offline
const memoryDb = {
  users: [],
  games: [],
  userAutoId: 1
};

// Unified DB Query Adapter supporting both MongoDB Mongoose and In-Memory fallback
const dbQuery = {
  findUserByUsernameOrEmail: async (identifier) => {
    if (isConnected) {
      return await User.findOne({
        $or: [
          { username: new RegExp(`^${identifier}$`, 'i') },
          { email: new RegExp(`^${identifier}$`, 'i') }
        ]
      });
    }
    const lower = identifier.toLowerCase();
    const found = memoryDb.users.find(u => u.username.toLowerCase() === lower || u.email.toLowerCase() === lower);
    return found ? { ...found, _id: found.id } : null;
  },

  findUserById: async (id) => {
    if (isConnected && mongoose.Types.ObjectId.isValid(id)) {
      return await User.findById(id).select('-password_hash');
    }
    const found = memoryDb.users.find(u => String(u.id) === String(id));
    return found ? { ...found, _id: found.id } : null;
  },

  createUser: async ({ username, email, password_hash }) => {
    if (isConnected) {
      const user = new User({ username, email, password_hash });
      await user.save();
      return user;
    }
    const newUser = {
      id: String(memoryDb.userAutoId++),
      _id: String(memoryDb.userAutoId),
      username,
      email,
      password_hash,
      rating: 1200,
      wins: 0,
      losses: 0,
      draws: 0,
      createdAt: new Date()
    };
    memoryDb.users.push(newUser);
    return newUser;
  },

  saveGame: async (gameData) => {
    if (isConnected) {
      try {
        const game = new Game({
          roomId: gameData.roomId,
          whitePlayerId: gameData.whitePlayerId && mongoose.Types.ObjectId.isValid(gameData.whitePlayerId) ? gameData.whitePlayerId : null,
          blackPlayerId: gameData.blackPlayerId && mongoose.Types.ObjectId.isValid(gameData.blackPlayerId) ? gameData.blackPlayerId : null,
          whiteUsername: gameData.whiteUsername,
          blackUsername: gameData.blackUsername,
          winner: gameData.winner,
          resultReason: gameData.resultReason,
          timeControl: gameData.timeControl,
          pgn: gameData.pgn,
          fen: gameData.fen
        });
        await game.save();

        // Update player stats
        if (gameData.winner === 'white' && gameData.whitePlayerId) {
          await User.findByIdAndUpdate(gameData.whitePlayerId, { $inc: { wins: 1, rating: 15 } });
          if (gameData.blackPlayerId) await User.findByIdAndUpdate(gameData.blackPlayerId, { $inc: { losses: 1 }, $set: { rating: Math.max(800, rating - 15) } });
        } else if (gameData.winner === 'black' && gameData.blackPlayerId) {
          await User.findByIdAndUpdate(gameData.blackPlayerId, { $inc: { wins: 1, rating: 15 } });
          if (gameData.whitePlayerId) await User.findByIdAndUpdate(gameData.whitePlayerId, { $inc: { losses: 1 }, $set: { rating: Math.max(800, rating - 15) } });
        } else if (gameData.winner === 'draw') {
          if (gameData.whitePlayerId) await User.findByIdAndUpdate(gameData.whitePlayerId, { $inc: { draws: 1 } });
          if (gameData.blackPlayerId) await User.findByIdAndUpdate(gameData.blackPlayerId, { $inc: { draws: 1 } });
        }
        return game;
      } catch (err) {
        console.error('Error saving game to MongoDB:', err.message);
      }
    }

    const memoryGame = { ...gameData, id: gameData.roomId, createdAt: new Date() };
    memoryDb.games.push(memoryGame);
    return memoryGame;
  },

  getUserGameHistory: async (userId) => {
    if (isConnected && mongoose.Types.ObjectId.isValid(userId)) {
      return await Game.find({
        $or: [{ whitePlayerId: userId }, { blackPlayerId: userId }]
      }).sort({ createdAt: -1 }).limit(50);
    }
    return memoryDb.games.filter(g => String(g.whitePlayerId) === String(userId) || String(g.blackPlayerId) === String(userId));
  }
};

module.exports = { User, Game, dbQuery, isConnected: () => isConnected };
