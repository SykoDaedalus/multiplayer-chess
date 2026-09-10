# AWS Deployment Guide for Multiplayer Chess

This guide provides step-by-step instructions for deploying your real-time Node.js + Socket.io + MongoDB multiplayer chess application on AWS.

---

## 🍃 MongoDB Setup Options

### Option A: Automatic Docker Container (Easiest)
When running with `docker-compose.yml`, Docker automatically provisions and links a production MongoDB database container alongside your app. No manual database setup required!

### Option B: Free Cloud Database via MongoDB Atlas
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a Free M0 Shared Cluster.
3. Under **Database Access**, create a database user and password.
4. Under **Network Access**, add IP `0.0.0.0/0` (allow access from anywhere).
5. Copy your connection string e.g. `mongodb+srv://<username>:<password>@cluster.mongodb.net/chess_db?retryWrites=true&w=majority`.
6. Set `MONGODB_URI` in your `.env` file to this connection string.

---

## Option 1: AWS EC2 (Recommended Deployment)

### Step 1: Launch an AWS EC2 Instance
1. Log into your **AWS Management Console** and navigate to **EC2**.
2. Click **Launch Instance**.
3. Choose an OS: **Ubuntu 22.04 LTS** or **Amazon Linux 2023** (t2.micro or t3.small).
4. Under **Key pair**, select an existing SSH key pair or create a new `.pem` key pair.
5. Under **Network settings / Security Group**, configure the following inbound rules:
   | Type | Protocol | Port Range | Source |
   | :--- | :--- | :--- | :--- |
   | SSH | TCP | 22 | My IP / 0.0.0.0/0 |
   | HTTP | TCP | 80 | Anywhere (0.0.0.0/0) |
   | HTTPS | TCP | 443 | Anywhere (0.0.0.0/0) |
   | Custom TCP | TCP | 3000 | Anywhere (0.0.0.0/0) *(optional for direct node port access)* |
6. Click **Launch Instance**.

---

### Step 2: Connect to Your EC2 Instance via SSH
```bash
chmod 400 your-key.pem
ssh -i "your-key.pem" ubuntu@YOUR_EC2_PUBLIC_IP
```

---

### Step 3: Clone/Upload Code and Run Automated Deployment Script
Transfer your project files to the EC2 server or clone from your Git repo:
```bash
git clone <your-repository-url> multiplayer-chess
cd multiplayer-chess
```

Run the automated AWS setup script:
```bash
chmod +x scripts/deploy-aws.sh
./scripts/deploy-aws.sh
```

This script automatically:
1. Installs Node.js 20, Docker, and Nginx.
2. Generates a secure `.env` configuration file with JWT secret key and MongoDB URI.
3. Builds and launches the app & MongoDB Docker containers.
4. Configures Nginx reverse proxy with WebSocket (`Upgrade` and `Connection`) support.

Your app is now live at: `http://YOUR_EC2_PUBLIC_IP`!

---

### Step 4: (Optional) Attach Domain & Enable Free SSL (HTTPS)
If you have a domain pointing to your EC2 IP address:
```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```
Certbot automatically configures HTTPS and updates your Nginx configuration.

---

## Option 2: AWS App Runner (Serverless Container Hosting)

1. Push your container to **Amazon ECR** (Elastic Container Registry):
   ```bash
   aws ecr create-repository --repository-name multiplayer-chess
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com
   docker build -t multiplayer-chess .
   docker tag multiplayer-chess:latest YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/multiplayer-chess:latest
   docker push YOUR_ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/multiplayer-chess:latest
   ```
2. Open **AWS App Runner** in the Console -> **Create Service**.
3. Select **Container Registry** -> choose your ECR image.
4. Set Port to `3000`.
5. Under Environment Variables, set `MONGODB_URI` (MongoDB Atlas URI) and `JWT_SECRET`.
6. Click **Create & Deploy**. App Runner provides an automated HTTPS URL!
