# 🚀 Render.com Deployment Guide for Multiplayer Chess

Deploying your Node.js + Socket.io + MongoDB chess app on [Render.com](https://render.com) is free, fast, and includes automatic SSL (HTTPS/WSS) and native WebSocket support out of the box.

---

## 📋 Step-by-Step Deployment Instructions

### Step 1: Push Code to GitHub / GitLab
1. Initialize Git in your project folder (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Deploy multiplayer chess to Render"
   ```
2. Create a new repository on GitHub/GitLab and push your code:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/multiplayer-chess.git
   git branch -M main
   git push -u origin main
   ```

---

### Step 2: Create a Web Service on Render
1. Log into your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** -> select **Web Service**.
3. Connect your **GitHub / GitLab** repository.
4. Fill in the service configuration details:
   - **Name**: `multiplayer-chess` (or any custom name)
   - **Region**: Select your preferred region (e.g., Singapore, Frankfurt, Oregon)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free** (or Starter)

---

### Step 3: Configure Environment Variables
Under the **Environment Variables** section on Render, add the following key-value pairs:

| Key | Value | Notes |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production mode |
| `JWT_SECRET` | `super-secret-key-change-me` | Secret key for signing JWT tokens |
| `MONGODB_URI` | `mongodb+srv://Phantom:Phantommongodb1!@cluster0.xivgshy.mongodb.net/chess_db?retryWrites=true&w=majority&appName=Cluster0` | Your MongoDB Atlas connection string |

---

### Step 4: Click "Create Web Service"
1. Click **Create Web Service**.
2. Render will automatically pull your code, install dependencies (`npm install`), and start the node server (`npm start`).
3. Once the build finishes, Render provides a free HTTPS URL:
   `https://multiplayer-chess-xxxx.onrender.com`

---

## ⚡ WebSockets & Features on Render

- **Automatic SSL**: Render automatically generates free HTTPS and WSS (secure WebSockets) certificates for your domain.
- **Real-Time Multiplayer**: Socket.io real-time room pairing, time controls, and draw offers work out of the box with zero additional configuration!
- **MongoDB Atlas Persistence**: All user profiles, bcrypt password hashes, and match records are saved directly to your MongoDB Atlas cloud database.
