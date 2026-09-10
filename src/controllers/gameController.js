const { dbQuery } = require('../config/database');

const getGameHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const games = await dbQuery.getUserGameHistory(userId);
    return res.json({ games });
  } catch (err) {
    console.error('Error fetching game history:', err);
    return res.status(500).json({ error: 'Failed to fetch game history' });
  }
};

const getGameById = async (req, res) => {
  try {
    const { roomId } = req.params;
    const game = await dbQuery.findGameByRoomId ? await dbQuery.findGameByRoomId(roomId) : null;

    if (!game) {
      return res.status(404).json({ error: 'Game record not found' });
    }

    return res.json({ game });
  } catch (err) {
    console.error('Error fetching game details:', err);
    return res.status(500).json({ error: 'Failed to fetch game details' });
  }
};

module.exports = { getGameHistory, getGameById };
