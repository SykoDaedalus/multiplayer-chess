// Real-Time Socket.io Client Wrapper Module
(function (window) {
  let socket = null;

  const SocketClient = {
    init: function () {
      const token = localStorage.getItem('chess_jwt_token');

      socket = io({
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
      });

      socket.on('connect', () => {
        console.log('⚡ Socket connected:', socket.id);
      });

      socket.on('disconnect', (reason) => {
        console.warn('⚠️ Socket disconnected:', reason);
      });

      socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
      });
    },

    reauthenticate: function (newToken) {
      if (socket) {
        socket.disconnect();
      }
      localStorage.setItem('chess_jwt_token', newToken || '');
      this.init();
    },

    getSocket: function () {
      return socket;
    },

    quickMatch: function (options, callback) {
      if (!socket) return;
      socket.emit('quick_match', options, callback);
    },

    createRoom: function (options, callback) {
      if (!socket) return;
      socket.emit('create_room', options, callback);
    },

    joinRoom: function (roomId, callback) {
      if (!socket) return;
      socket.emit('join_room', { roomId }, callback);
    },

    makeMove: function (data, callback) {
      if (!socket) return;
      socket.emit('make_move', data, callback);
    },

    resign: function (roomId, callback) {
      if (!socket) return;
      socket.emit('resign', { roomId }, callback);
    },

    offerDraw: function (roomId, callback) {
      if (!socket) return;
      socket.emit('offer_draw', { roomId }, callback);
    },

    acceptDraw: function (roomId, callback) {
      if (!socket) return;
      socket.emit('accept_draw', { roomId }, callback);
    },

    declineDraw: function (roomId, callback) {
      if (!socket) return;
      socket.emit('decline_draw', { roomId }, callback);
    },

    guestSignedIn: function (roomId, guestUserId) {
      if (!socket) return;
      socket.emit('guest_signed_in', { roomId, guestUserId });
    },

    sendChat: function (roomId, message) {
      if (!socket) return;
      socket.emit('send_chat', { roomId, message });
    },

    requestRematch: function (roomId) {
      if (!socket) return;
      socket.emit('request_rematch', { roomId });
    },

    on: function (event, handler) {
      if (socket) socket.on(event, handler);
    },

    off: function (event, handler) {
      if (socket) socket.off(event, handler);
    }
  };

  window.SocketClient = SocketClient;
})(window);
