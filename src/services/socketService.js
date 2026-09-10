const gameManager = require('./gameManager');

const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    const user = socket.user || { id: `guest_${socket.id}`, username: 'Guest' };
    console.log(`Socket connected: ${socket.id} (User: ${user.username})`);

    // Quick Match Matchmaking
    socket.on('quick_match', (data, callback) => {
      try {
        const { timeControl = '5+3' } = data || {};
        const { room, role } = gameManager.findOrCreateMatchmakingRoom(user, timeControl, socket.id);

        socket.join(room.id);
        const roomState = gameManager.getPublicRoomState(room);

        io.to(room.id).emit('room_state', roomState);
        io.to(room.id).emit('player_joined', { username: user.username, role, state: roomState });

        if (typeof callback === 'function') {
          callback({ success: true, roomId: room.id, role, state: roomState });
        }
      } catch (err) {
        console.error('Error in quick_match socket event:', err);
        if (typeof callback === 'function') callback({ error: 'Server processing error' });
      }
    });

    // Create Private Friend Room
    socket.on('create_room', (data, callback) => {
      try {
        const { timeControl = '5+3', preferredColor = 'random' } = data || {};
        const room = gameManager.createRoom(user, timeControl, preferredColor, true);

        socket.join(room.id);
        const joinResult = gameManager.joinRoom(room.id, user, socket.id);
        const roomState = gameManager.getPublicRoomState(room);

        if (typeof callback === 'function') {
          callback({ success: true, roomId: room.id, role: joinResult.role, state: roomState });
        }
      } catch (err) {
        console.error('Error in create_room socket event:', err);
        if (typeof callback === 'function') callback({ error: 'Failed to create room' });
      }
    });

    // Join Room (via Room Code or Share Link)
    socket.on('join_room', (data, callback) => {
      try {
        const { roomId } = data || {};
        const room = gameManager.getRoom(roomId);

        if (!room) {
          if (typeof callback === 'function') callback({ error: 'Room not found' });
          return;
        }

        socket.join(roomId);
        const { role } = gameManager.joinRoom(roomId, user, socket.id);
        const roomState = gameManager.getPublicRoomState(room);

        io.to(roomId).emit('room_state', roomState);
        io.to(roomId).emit('player_joined', { username: user.username, role, state: roomState });

        if (typeof callback === 'function') {
          callback({ success: true, roomId, role, state: roomState });
        }
      } catch (err) {
        console.error('Error in join_room socket event:', err);
        if (typeof callback === 'function') callback({ error: 'Failed to join room' });
      }
    });

    // Make Move
    socket.on('make_move', (data, callback) => {
      try {
        const { roomId, from, to, promotion } = data || {};
        const result = gameManager.makeMove(roomId, user, { from, to, promotion });

        if (result.error) {
          if (typeof callback === 'function') callback({ error: result.error });
          return;
        }

        const roomState = gameManager.getPublicRoomState(result.room);

        io.to(roomId).emit('move_made', {
          move: result.moveObj,
          state: roomState
        });

        if (result.room.gameOver) {
          io.to(roomId).emit('game_over', {
            winner: result.room.winner,
            reason: result.room.resultReason,
            state: roomState
          });
        }

        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        console.error('Error in make_move socket event:', err);
        if (typeof callback === 'function') callback({ error: 'Server error processing move' });
      }
    });

    // Guest Mid-Game Sign-In Abort Event
    socket.on('guest_signed_in', (data) => {
      try {
        const { roomId, guestUserId } = data || {};
        const result = gameManager.abortGuestGameOnAuthChange(roomId, guestUserId);
        if (result && result.room) {
          const roomState = gameManager.getPublicRoomState(result.room);
          io.to(roomId).emit('game_over', {
            winner: result.winner,
            reason: 'abandonment',
            state: roomState
          });
        }
      } catch (err) {
        console.error('Error in guest_signed_in event:', err);
      }
    });

    // Resign
    socket.on('resign', (data, callback) => {
      try {
        const { roomId } = data || {};
        const result = gameManager.resign(roomId, user);

        if (result.error) {
          if (typeof callback === 'function') callback({ error: result.error });
          return;
        }

        const roomState = gameManager.getPublicRoomState(result.room);
        io.to(roomId).emit('game_over', {
          winner: result.room.winner,
          reason: result.room.resultReason,
          state: roomState
        });

        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        console.error('Error in resign socket event:', err);
      }
    });

    // Offer Draw
    socket.on('offer_draw', (data, callback) => {
      try {
        const { roomId } = data || {};
        const result = gameManager.offerDraw(roomId, user);

        if (result.error) {
          if (typeof callback === 'function') callback({ error: result.error });
          return;
        }

        const roomState = gameManager.getPublicRoomState(result.room);
        io.to(roomId).emit('draw_offered', { offeredBy: user.username, state: roomState });

        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        console.error('Error in offer_draw socket event:', err);
      }
    });

    // Decline Draw
    socket.on('decline_draw', (data, callback) => {
      try {
        const { roomId } = data || {};
        const result = gameManager.declineDraw(roomId, user);

        if (result.error) {
          if (typeof callback === 'function') callback({ error: result.error });
          return;
        }

        const roomState = gameManager.getPublicRoomState(result.room);
        io.to(roomId).emit('draw_declined', { declinedBy: user.username, state: roomState });

        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        console.error('Error in decline_draw socket event:', err);
      }
    });

    // Accept Draw
    socket.on('accept_draw', (data, callback) => {
      try {
        const { roomId } = data || {};
        const result = gameManager.acceptDraw(roomId, user);

        if (result.error) {
          if (typeof callback === 'function') callback({ error: result.error });
          return;
        }

        const roomState = gameManager.getPublicRoomState(result.room);
        io.to(roomId).emit('game_over', {
          winner: result.room.winner,
          reason: result.room.resultReason,
          state: roomState
        });

        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        console.error('Error in accept_draw socket event:', err);
      }
    });

    // In-game Chat
    socket.on('send_chat', (data) => {
      try {
        const { roomId, message } = data || {};
        const room = gameManager.getRoom(roomId);

        if (room && message && message.trim().length > 0) {
          const chatItem = {
            sender: user.username,
            text: message.trim().substring(0, 200),
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          };
          room.chatMessages.push(chatItem);
          io.to(roomId).emit('chat_message', chatItem);
        }
      } catch (err) {
        console.error('Error in send_chat socket event:', err);
      }
    });

    // Rematch Request
    socket.on('request_rematch', (data) => {
      try {
        const { roomId } = data || {};
        const room = gameManager.getRoom(roomId);
        if (room && room.gameOver) {
          const oldWhite = room.white;
          const oldBlack = room.black;
          const newRoom = gameManager.createRoom(
            { id: oldBlack?.id, username: oldBlack?.username },
            room.timeControl,
            'white',
            true
          );
          if (oldWhite) {
            gameManager.joinRoom(newRoom.id, { id: oldWhite.id, username: oldWhite.username }, oldWhite.socketId);
          }

          io.to(roomId).emit('rematch_accepted', { newRoomId: newRoom.id });
        }
      } catch (err) {
        console.error('Error in request_rematch socket event:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};

module.exports = { setupSocketHandlers };
