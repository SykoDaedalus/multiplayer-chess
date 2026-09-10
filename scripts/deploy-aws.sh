#!/usr/bin/env bash
# AWS Deployment Script for Multiplayer Chess Web Application
set -e

echo "🚀 Starting AWS Automated Deployment..."

# 1. Update system packages
sudo apt-get update -y && sudo apt-get upgrade -y

# 2. Install Node.js, Docker, and Nginx if not installed
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

if ! command -v docker &> /dev/null; then
    echo "🐳 Installing Docker & Docker Compose..."
    sudo apt-get install -y docker.io docker-compose
    sudo systemctl start docker
    sudo systemctl enable docker
    sudo usermod -aG docker $USER
fi

if ! command -v nginx &> /dev/null; then
    echo "🌐 Installing Nginx Web Server..."
    sudo apt-get install -y nginx
fi

# 3. Create app environment file if missing
if [ ! -f .env ]; then
    echo "🔑 Generating production .env file..."
    cp .env.example .env
    sed -i "s/your_jwt_secret_key_here/$(openssl rand -hex 32)/g" .env
fi

# 4. Build and start Docker container
echo "🏗️ Building Docker image & starting container..."
docker-compose down || true
docker-compose up --build -d

# 5. Configure Nginx Reverse Proxy with WebSocket support
echo "⚙️ Configuring Nginx reverse proxy..."
sudo cat << 'EOF' | sudo tee /etc/nginx/sites-available/multiplayer-chess
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/multiplayer-chess /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

echo "✅ AWS Deployment Complete!"
echo "🌐 Your Multiplayer Chess app is now live on port 80!"
