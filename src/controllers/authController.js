const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { dbQuery } = require('../config/database');
const { JWT_SECRET } = require('../middleware/authMiddleware');

const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be between 3 and 20 characters' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists in MongoDB
    const existingUser = await dbQuery.findUserByUsernameOrEmail(username);
    const existingEmail = await dbQuery.findUserByUsernameOrEmail(email);

    if (existingUser || existingEmail) {
      return res.status(400).json({ error: 'Username or email is already registered' });
    }

    // Encrypt password using bcryptjs
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Save user to MongoDB
    const user = await dbQuery.createUser({
      username,
      email,
      password_hash: passwordHash
    });

    const userId = user._id || user.id;
    const userPayload = { id: userId, username: user.username, email: user.email };

    // Issue JWT token
    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: userId,
        username: user.username,
        email: user.email,
        rating: user.rating || 1200,
        wins: user.wins || 0,
        losses: user.losses || 0,
        draws: user.draws || 0
      }
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Internal server error during registration' });
  }
};

const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' });
    }

    // Lookup user in MongoDB
    const user = await dbQuery.findUserByUsernameOrEmail(username);
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    // Verify password with bcrypt
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const userId = user._id || user.id;
    const userPayload = { id: userId, username: user.username, email: user.email };

    // Issue JWT token
    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: userId,
        username: user.username,
        email: user.email,
        rating: user.rating || 1200,
        wins: user.wins || 0,
        losses: user.losses || 0,
        draws: user.draws || 0
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await dbQuery.findUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userId = user._id || user.id;

    return res.json({
      user: {
        id: userId,
        username: user.username,
        email: user.email,
        rating: user.rating || 1200,
        wins: user.wins || 0,
        losses: user.losses || 0,
        draws: user.draws || 0,
        createdAt: user.createdAt
      }
    });
  } catch (err) {
    console.error('Get profile error:', err);
    return res.status(500).json({ error: 'Failed to fetch user profile' });
  }
};

module.exports = { register, login, getMe };
