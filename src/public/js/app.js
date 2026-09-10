// Main Application Controller & Router
document.addEventListener('DOMContentLoaded', () => {
  let currentUser = null;
  let currentRoomId = null;

  // Initialize Modules
  SocketClient.init();
  ChessGame.init();

  // Check saved JWT session
  checkAuthSession();

  // Check if URL has ?room=code parameter for auto-join
  checkUrlRoomInvite();

  // Bind Header Buttons
  document.getElementById('btn-open-auth').addEventListener('click', () => openModal('modal-auth'));
  document.getElementById('btn-close-auth').addEventListener('click', () => closeModal('modal-auth'));
  document.getElementById('btn-logout').addEventListener('click', handleLogout);

  document.getElementById('btn-open-history').addEventListener('click', openHistoryModal);
  document.getElementById('btn-close-history').addEventListener('click', () => closeModal('modal-history'));

  document.getElementById('btn-close-invite').addEventListener('click', () => closeModal('modal-invite'));
  document.getElementById('btn-copy-invite-link').addEventListener('click', copyInviteLink);

  // Brand Logo Click -> Return to Lobby
  document.getElementById('brand-logo').addEventListener('click', (e) => {
    e.preventDefault();
    switchView('lobby');
  });

  // Auth Modal Tabs Toggle
  const tabLogin = document.getElementById('tab-login');
  const tabRegister = document.getElementById('tab-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');

  tabLogin.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister.classList.remove('active');
    formLogin.style.display = 'block';
    formRegister.style.display = 'none';
  });

  tabRegister.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin.classList.remove('active');
    formRegister.style.display = 'block';
    formLogin.style.display = 'none';
  });

  // Login Form Submission
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (!res.ok) {
        errEl.innerText = data.error || 'Login failed';
        errEl.style.display = 'block';
        return;
      }

      // Check if user was in a guest match -> Abort guest game per rule
      const myRole = ChessGame.getPlayerRole();
      if (currentRoomId && (myRole === 'white' || myRole === 'black')) {
        SocketClient.guestSignedIn(currentRoomId, SocketClient.getSocket()?.id ? `guest_${SocketClient.getSocket().id}` : null);
      }

      localStorage.setItem('chess_jwt_token', data.token);
      currentUser = data.user;
      updateUserHeaderUI(currentUser);
      closeModal('modal-auth');

      SocketClient.reauthenticate(data.token);
    } catch (err) {
      errEl.innerText = 'Network error occurred';
      errEl.style.display = 'block';
    }
  });

  // Register Form Submission
  formRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const errEl = document.getElementById('reg-error');
    errEl.style.display = 'none';

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password })
      });
      const data = await res.json();

      if (!res.ok) {
        errEl.innerText = data.error || 'Registration failed';
        errEl.style.display = 'block';
        return;
      }

      // Check if user was in a guest match -> Abort guest game per rule
      const myRole = ChessGame.getPlayerRole();
      if (currentRoomId && (myRole === 'white' || myRole === 'black')) {
        SocketClient.guestSignedIn(currentRoomId, SocketClient.getSocket()?.id ? `guest_${SocketClient.getSocket().id}` : null);
      }

      localStorage.setItem('chess_jwt_token', data.token);
      currentUser = data.user;
      updateUserHeaderUI(currentUser);
      closeModal('modal-auth');

      SocketClient.reauthenticate(data.token);
    } catch (err) {
      errEl.innerText = 'Network error occurred';
      errEl.style.display = 'block';
    }
  });

  // Time Control Card Clicks
  document.querySelectorAll('.tc-card').forEach(card => {
    card.addEventListener('click', () => {
      const tc = card.getAttribute('data-tc');
      startQuickMatch(tc);
    });
  });

  // Friend Room Button
  document.getElementById('btn-create-friend-room').addEventListener('click', () => {
    createFriendRoom('5+3');
  });

  document.getElementById('btn-join-room-code').addEventListener('click', () => {
    const code = document.getElementById('input-room-code').value.trim();
    if (code.length === 6) {
      joinRoom(code);
    } else {
      alert('Please enter a valid 6-character room code');
    }
  });

  // Game Action Buttons
  document.getElementById('btn-share-invite').addEventListener('click', () => {
    if (currentRoomId) showInviteModal(currentRoomId);
  });

  document.getElementById('room-code-badge').addEventListener('click', () => {
    if (currentRoomId) showInviteModal(currentRoomId);
  });

  document.getElementById('btn-offer-draw').addEventListener('click', () => {
    if (currentRoomId) {
      SocketClient.offerDraw(currentRoomId, (res) => {
        if (res.error) alert(res.error);
      });
    }
  });

  // Draw Offer Banner Action Buttons (Accept & Decline)
  document.getElementById('btn-accept-draw-banner').addEventListener('click', () => {
    if (currentRoomId) {
      SocketClient.acceptDraw(currentRoomId);
      hideDrawOfferBanner();
    }
  });

  document.getElementById('btn-decline-draw-banner').addEventListener('click', () => {
    if (currentRoomId) {
      SocketClient.declineDraw(currentRoomId);
      hideDrawOfferBanner();
    }
  });

  document.getElementById('btn-resign').addEventListener('click', () => {
    if (currentRoomId && confirm('Are you sure you want to resign this match?')) {
      SocketClient.resign(currentRoomId, (res) => {
        if (res.error) alert(res.error);
      });
    }
  });

  document.getElementById('btn-rematch').addEventListener('click', () => {
    if (currentRoomId) {
      SocketClient.requestRematch(currentRoomId);
    }
  });

  document.getElementById('btn-leave-game').addEventListener('click', () => {
    if (confirm('Leave this game room?')) {
      currentRoomId = null;
      switchView('lobby');
    }
  });

  // Chat Submission
  const inputChat = document.getElementById('input-chat-msg');
  const btnSendChat = document.getElementById('btn-send-chat');

  function sendChatMessage() {
    const msg = inputChat.value.trim();
    if (msg && currentRoomId) {
      SocketClient.sendChat(currentRoomId, msg);
      inputChat.value = '';
    }
  }

  btnSendChat.addEventListener('click', sendChatMessage);
  inputChat.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });

  // Socket Event Listeners
  SocketClient.on('room_state', (state) => {
    if (currentRoomId === state.id) {
      ChessGame.updateUI(state);
      updateDrawBannerState(state);
    }
  });

  SocketClient.on('player_joined', (data) => {
    appendChatMessage('System', `${data.username} joined as ${data.role}`);
    if (data.state && currentRoomId === data.state.id) {
      ChessGame.setRoomData(data.state.id, ChessGame.getPlayerRole(), data.state);
      updateDrawBannerState(data.state);
    }
  });

  SocketClient.on('move_made', (data) => {
    ChessGame.handleMoveMade(data);
    hideDrawOfferBanner();
  });

  SocketClient.on('game_over', (data) => {
    ChessGame.handleGameOver(data);
    hideDrawOfferBanner();
  });

  SocketClient.on('draw_offered', (data) => {
    appendChatMessage('System', `${data.offeredBy} offered a draw.`);
    updateDrawBannerState(data.state, data.offeredBy);
  });

  SocketClient.on('draw_declined', (data) => {
    appendChatMessage('System', `Draw offer declined by ${data.declinedBy}.`);
    hideDrawOfferBanner();
  });

  SocketClient.on('chat_message', (data) => {
    appendChatMessage(data.sender, data.text, data.timestamp);
  });

  SocketClient.on('rematch_accepted', (data) => {
    joinRoom(data.newRoomId);
  });

  // Draw Banner Manager
  function updateDrawBannerState(state, offeredByUsername) {
    const banner = document.getElementById('draw-offer-banner');
    const textEl = document.getElementById('draw-offer-text');
    const acceptBtn = document.getElementById('btn-accept-draw-banner');
    const declineBtn = document.getElementById('btn-decline-draw-banner');

    if (state.drawOfferedBy && !state.gameOver) {
      const myRole = ChessGame.getPlayerRole();
      const isMyOffer = state.drawOfferedBy === myRole;

      banner.style.display = 'flex';

      if (isMyOffer) {
        textEl.innerText = '🤝 Draw offered to opponent...';
        acceptBtn.style.display = 'none';
        declineBtn.style.display = 'none';
      } else {
        const senderName = offeredByUsername || (state.drawOfferedBy === 'white' ? state.white?.username : state.black?.username) || 'Opponent';
        textEl.innerText = `🤝 ${senderName} offered a draw`;
        acceptBtn.style.display = 'inline-flex';
        declineBtn.style.display = 'inline-flex';
      }
    } else {
      banner.style.display = 'none';
    }
  }

  function hideDrawOfferBanner() {
    document.getElementById('draw-offer-banner').style.display = 'none';
  }

  // Helper Functions
  function startQuickMatch(timeControl) {
    SocketClient.quickMatch({ timeControl }, (res) => {
      if (res.error) {
        alert('Matchmaking error: ' + res.error);
        return;
      }

      currentRoomId = res.roomId;
      ChessGame.setRoomData(res.roomId, res.role, res.state);
      switchView('game');
      document.getElementById('room-code-badge').innerText = `Room: ${res.roomId}`;

      if (!res.state.gameStarted) {
        showInviteModal(res.roomId);
      }
    });
  }

  function createFriendRoom(timeControl) {
    SocketClient.createRoom({ timeControl, preferredColor: 'random' }, (res) => {
      if (res.error) {
        alert('Failed to create room: ' + res.error);
        return;
      }

      currentRoomId = res.roomId;
      ChessGame.setRoomData(res.roomId, res.role, res.state);
      switchView('game');
      document.getElementById('room-code-badge').innerText = `Room: ${res.roomId}`;
      showInviteModal(res.roomId);
    });
  }

  function joinRoom(roomId) {
    SocketClient.joinRoom(roomId, (res) => {
      if (res.error) {
        alert('Error joining room: ' + res.error);
        return;
      }

      currentRoomId = res.roomId;
      ChessGame.setRoomData(res.roomId, res.role, res.state);
      switchView('game');
      document.getElementById('room-code-badge').innerText = `Room: ${res.roomId}`;
    });
  }

  function checkUrlRoomInvite() {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam && roomParam.length === 6) {
      joinRoom(roomParam);
    }
  }

  function switchView(viewName) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');

    if (viewName === 'game') {
      ChessGame.resizeBoard();
    }
  }

  function openModal(id) {
    document.getElementById(id).classList.add('active');
  }

  function closeModal(id) {
    document.getElementById(id).classList.remove('active');
  }

  function showInviteModal(roomId) {
    const inviteUrl = `${window.location.origin}/?room=${roomId}`;
    document.getElementById('display-invite-code').innerText = roomId;
    document.getElementById('input-invite-link').value = inviteUrl;
    openModal('modal-invite');
  }

  function copyInviteLink() {
    const input = document.getElementById('input-invite-link');
    input.select();
    navigator.clipboard.writeText(input.value);
    alert('🔗 Invite link copied to clipboard!');
  }

  async function checkAuthSession() {
    const token = localStorage.getItem('chess_jwt_token');
    if (!token) return;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        currentUser = data.user;
        updateUserHeaderUI(currentUser);
      } else {
        localStorage.removeItem('chess_jwt_token');
      }
    } catch (e) {}
  }

  function updateUserHeaderUI(user) {
    if (user) {
      document.getElementById('user-name-display').innerText = user.username;
      document.getElementById('user-rating-display').innerText = `(${user.rating || 1200})`;
      document.getElementById('btn-open-auth').style.display = 'none';
      document.getElementById('btn-logout').style.display = 'inline-flex';
    } else {
      document.getElementById('user-name-display').innerText = 'Guest';
      document.getElementById('user-rating-display').innerText = '(1200)';
      document.getElementById('btn-open-auth').style.display = 'inline-flex';
      document.getElementById('btn-logout').style.display = 'none';
    }
  }

  function handleLogout() {
    localStorage.removeItem('chess_jwt_token');
    currentUser = null;
    updateUserHeaderUI(null);
    SocketClient.reauthenticate(null);
  }

  async function openHistoryModal() {
    const token = localStorage.getItem('chess_jwt_token');
    const container = document.getElementById('history-list-container');
    openModal('modal-history');

    if (!token) {
      container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 1rem;">Please sign in to view your match history.</p>';
      return;
    }

    try {
      const res = await fetch('/api/games/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (!data.games || data.games.length === 0) {
        container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 1rem;">No played matches found yet.</p>';
        return;
      }

      container.innerHTML = '';
      data.games.forEach(g => {
        const item = document.createElement('div');
        item.style.cssText = 'background: var(--bg-primary); padding: 0.75rem 1rem; border-radius: 4px; border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;';
        const isWin = g.winner === (g.white_username === currentUser.username ? 'white' : 'black');
        const badgeColor = g.winner === 'draw' ? 'var(--text-muted)' : isWin ? 'var(--accent-green)' : 'var(--accent-red)';
        const dateStr = new Date(g.createdAt || g.created_at).toLocaleDateString();

        item.innerHTML = `
          <div>
            <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-bright);">${g.whiteUsername || g.white_username} vs ${g.blackUsername || g.black_username}</div>
            <div style="font-size: 0.8rem; color: var(--text-muted);">${g.timeControl || g.time_control} • ${dateStr}</div>
          </div>
          <div style="font-weight: 700; color: ${badgeColor}; font-size: 0.85rem;">${g.winner === 'draw' ? 'DRAW' : isWin ? 'WIN' : 'LOSS'}</div>
        `;
        container.appendChild(item);
      });
    } catch (err) {
      container.innerHTML = '<p style="color: var(--accent-red); text-align: center;">Failed to load match history.</p>';
    }
  }

  function appendChatMessage(sender, text, time) {
    const container = document.getElementById('chat-messages');
    const msgEl = document.createElement('div');
    msgEl.className = 'chat-msg';
    const timeStr = time ? ` <span style="font-size: 0.7rem; color: var(--text-muted);">(${time})</span>` : '';
    msgEl.innerHTML = `<span class="sender">${sender}:</span> ${text}${timeStr}`;
    container.appendChild(msgEl);
    container.scrollTop = container.scrollHeight;
  }
});
