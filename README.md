# ♟️ Real-Time Multiplayer Chess Web Application

A full-stack, real-time multiplayer chess web application built with **Node.js**, **Express**, **Socket.io**, **JWT Authentication**, **Chessboard.js**, **Chess.js**, and **Stockfish Engine Analysis**, ready for AWS deployment.

---

## 🌟 Key Features

1. **User Sign In & Authentication**:
   - Register and login with email/username.
   - Secure password hashing with `bcryptjs` and JSON Web Token (JWT) authentication.
   - User rating and match history tracking.

2. **Time Control Selection & Matchmaking**:
   - **1|0 Bullet**, **3|0 Blitz**, **5|3 Blitz**, **10|0 Rapid**, **15|10 Classical**, and custom rules.
   - Real-time countdown clocks with millisecond accuracy and time decay.

3. **Play with a Friend**:
   - Instant room code generation (e.g. `a7x8q2`).
   - Shareable invite links (`http://localhost:3000/?room=a7x8q2`).
   - Auto-orientation (White on bottom for White player, Black on bottom for Black player).

4. **Interactive Chessboard UI**:
   - Built using `chessboard.js` and `chess.js`.
   - Drag-and-drop piece movement & legal move validation.
   - Web Audio API sound effects for piece moves, captures, checks, and game ending alarms.
   - Status alerts for Check, Checkmate, Stalemate, 3-Fold Repetition, and Resignation.
   - In-game live chat & rematch requests.

5. **Post-Game Stockfish Engine Analysis**:
   - Dynamic Stockfish engine evaluation bar on the left of the board (showing advantage from -10 to +10 and mate in N).
   - Step-by-step PGN move navigation (`<<`, `<`, `>`, `>>`) allowing players to review every move of completed matches with Stockfish feedback.

6. **AWS Deployment Ready**:
   - `Dockerfile` & `docker-compose.yml`.
   - One-command Linux EC2 setup script (`scripts/deploy-aws.sh`).
   - Detailed deployment guide (`AWS_DEPLOYMENT_GUIDE.md`) for EC2, Nginx WebSocket reverse proxy, SSL Certbot, and AWS App Runner.

---

## 🚀 Quick Start (Local Run)

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Application Server
```bash
npm start
```
*Or run in watch mode for development:*
```bash
npm run dev
```

### 3. Open in Browser
Visit [http://localhost:3000](http://localhost:3000) to open the application.

To test multiplayer locally:
- Open two different browser windows (or one normal window and one Incognito window).
- Click **5+3 Blitz** or **Play with a Friend** in the first window.
- Copy the room code / invite link into the second window to start playing in real time!

---

## 📂 Project Structure

```
D:\multiplayer-chess\
├── package.json               # NPM package manifest
├── .env                       # Environment variables
├── Dockerfile                 # Production Docker image configuration
├── docker-compose.yml         # Container orchestration configuration
├── README.md                  # Project overview and quick start guide
├── AWS_DEPLOYMENT_GUIDE.md    # Detailed guide for AWS EC2, App Runner, Nginx & SSL
├── scripts/
│   └── deploy-aws.sh          # One-touch deployment script for AWS EC2
└── src/
    ├── server.js              # Express app & HTTP/Socket server entrypoint
    ├── config/
    │   └── database.js        # JSON file database layer & query helpers
    ├── middleware/
    │   └── authMiddleware.js  # JWT authentication for HTTP & WebSockets
    ├── routes/
    │   ├── authRoutes.js      # Register, Login, and Me endpoints
    │   └── gameRoutes.js      # Game history endpoints
    ├── controllers/
    │   ├── authController.js  # Authentication controllers
    │   └── gameController.js  # Game record controllers
    ├── services/
    │   ├── gameManager.js     # Real-time room, clock timers & chess state manager
    │   └── socketService.js   # Socket.io event listeners & handlers
    └── public/                # Frontend client assets
        ├── index.html         # Single Page Application HTML shell
        ├── css/
        │   └── style.css      # Dark glassmorphic design system
        └── js/
            ├── app.js         # Router, modals & main application controller
            ├── socketClient.js# Socket.io client wrapper
            ├── chessGame.js   # Chessboard.js integration, sounds, legal moves
            └── stockfishAnalysis.js # Stockfish engine analysis bar module
```
