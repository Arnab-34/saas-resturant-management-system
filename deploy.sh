#!/usr/bin/env bash
# ==============================================================================
# Astrikcoders Restaurant Management SaaS - One-Click VPS Deploy Script
# Tested on: Ubuntu 20.04 / 22.04 / 24.04 LTS (Hostinger, DigitalOcean, AWS, Hetzner)
# ==============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "===================================================================="
echo "    🚀 ASTRIKCODERS RESTAURANT MANAGEMENT SAAS - VPS INSTALLER     "
echo "===================================================================="
echo -e "${NC}"

# 1. Require Root / Sudo
if [ "$(id -u)" -ne 0 ]; then
  echo -e "${RED}[ERROR] This installer must be run as root or with sudo.${NC}"
  echo "Please run: sudo bash $0"
  exit 1
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# 2. Detect Server IP
SERVER_IP=$(curl -s https://api.ipify.org || hostname -I | awk '{print $1}')
echo -e "${BLUE}[INFO] Detected Server IP: ${BOLD}${SERVER_IP}${NC}"

# 3. Domain or IP Configuration
DOMAIN="${1:-}"
if [ -z "$DOMAIN" ]; then
  echo ""
  read -r -p "Enter your Domain Name (e.g., pos.yourdomain.com) or press ENTER to use Server IP: " INPUT_DOMAIN
  DOMAIN="${INPUT_DOMAIN:-$SERVER_IP}"
fi

USE_HTTPS="false"
if [[ "$DOMAIN" != "$SERVER_IP" && "$DOMAIN" != "localhost" && "$DOMAIN" != "127.0.0.1" ]]; then
  read -r -p "Do you want to configure automatic free SSL (HTTPS) for $DOMAIN? (y/n) [default: y]: " SSL_CHOICE
  SSL_CHOICE="${SSL_CHOICE:-y}"
  if [[ "$SSL_CHOICE" =~ ^[Yy]$ ]]; then
    USE_HTTPS="true"
  fi
fi

if [ "$USE_HTTPS" = "true" ]; then
  FRONTEND_URL="https://${DOMAIN}"
  COOKIE_SECURE="true"
else
  FRONTEND_URL="http://${DOMAIN}:1995"
  COOKIE_SECURE="false"
fi

echo -e "${GREEN}[INFO] Deploying for URL: ${BOLD}${FRONTEND_URL}${NC}"

# 4. Install Docker & Docker Compose if missing
echo -e "\n${BLUE}[1/5] Checking Docker and system prerequisites...${NC}"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null 2>&1

if ! command -v docker &>/dev/null; then
  echo -e "${YELLOW}[INFO] Docker not found. Installing Docker engine...${NC}"
  apt-get install -y ca-certificates curl gnupg lsb-release
  mkdir -p /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg --yes
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
    $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
  echo -e "${GREEN}[OK] Docker installed successfully.${NC}"
else
  echo -e "${GREEN}[OK] Docker is already installed.$(docker --version)${NC}"
fi

# Ensure docker compose command is available
if ! docker compose version &>/dev/null; then
  apt-get install -y docker-compose-plugin
fi

# 5. Firewall configuration (UFW)
if command -v ufw &>/dev/null && ufw status | grep -q "Status: active"; then
  echo -e "${BLUE}[INFO] Configuring UFW firewall rules...${NC}"
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw allow 1995/tcp >/dev/null 2>&1 || true
fi

# 6. Generate .env File
echo -e "\n${BLUE}[2/5] Configuring environment variables (.env)...${NC}"
if [ ! -f .env ]; then
  echo -e "${YELLOW}[INFO] Generating secure production .env file...${NC}"
  JWT_SECRET=$(openssl rand -hex 32)
  SUPER_ADMIN_JWT_SECRET=$(openssl rand -hex 32)
  POSTGRES_PASSWORD=$(openssl rand -hex 16)
  UPDATER_TOKEN=$(openssl rand -hex 16)

  cat <<EOF > .env
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
FRONTEND_ORIGIN=${FRONTEND_URL}
HOST_PORT=1995
COOKIE_SECURE=${COOKIE_SECURE}
UPDATER_TOKEN=${UPDATER_TOKEN}

# SaaS Configuration
SAAS_MODE=true
SUPER_ADMIN_EMAIL=admin@astrikcoders.com
SUPER_ADMIN_JWT_SECRET=${SUPER_ADMIN_JWT_SECRET}
EOF
  echo -e "${GREEN}[OK] Created .env with cryptographically secure keys.${NC}"
else
  echo -e "${GREEN}[OK] Existing .env file found. Keeping current secrets.${NC}"
  # Update FRONTEND_ORIGIN if domain provided
  if grep -q "FRONTEND_ORIGIN=" .env; then
    sed -i "s|FRONTEND_ORIGIN=.*|FRONTEND_ORIGIN=${FRONTEND_URL}|" .env
  else
    echo "FRONTEND_ORIGIN=${FRONTEND_URL}" >> .env
  fi
  sed -i "s|COOKIE_SECURE=.*|COOKIE_SECURE=${COOKIE_SECURE}|" .env
fi

# 7. Build and Start Containers
echo -e "\n${BLUE}[3/5] Building and launching Docker containers (this may take 2-4 minutes)...${NC}"
docker compose down --remove-orphans >/dev/null 2>&1 || true
docker compose up -d --build

# 8. Wait for Database & Initialize
echo -e "\n${BLUE}[4/5] Waiting for PostgreSQL database to be healthy...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0
until docker compose exec -T postgres pg_isready -U nodedr >/dev/null 2>&1 || [ $RETRY_COUNT -ge $MAX_RETRIES ]; do
  sleep 2
  RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
  echo -e "${RED}[ERROR] Database did not become healthy in time. Check logs: docker compose logs postgres${NC}"
  exit 1
fi
echo -e "${GREEN}[OK] PostgreSQL database is ready.${NC}"

echo -e "${BLUE}[INFO] Running database schema push and migrations...${NC}"
docker compose exec -T backend npx prisma db push --accept-data-loss

echo -e "${BLUE}[INFO] Seeding demo restaurant and default catalog...${NC}"
docker compose exec -T backend npx ts-node prisma/seed.ts

# Generate or fetch Super Admin credentials
SUPER_ADMIN_PASSWORD=$(openssl rand -hex 12)
docker compose exec -T postgres psql -U nodedr -d nodedr_restaurant -c \
  "INSERT INTO super_admins (id, email, password_hash, role, is_active, created_at, updated_at) \
   VALUES ('sa_init', 'admin@astrikcoders.com', crypt('${SUPER_ADMIN_PASSWORD}', gen_salt('bf', 10)), 'SUPER_ADMIN', true, NOW(), NOW()) \
   ON CONFLICT (email) DO UPDATE SET password_hash = crypt('${SUPER_ADMIN_PASSWORD}', gen_salt('bf', 10)), updated_at = NOW();" >/dev/null 2>&1 || true

# 9. Optional Caddy Reverse Proxy for Automatic HTTPS
if [ "$USE_HTTPS" = "true" ]; then
  echo -e "\n${BLUE}[5/5] Setting up automated HTTPS via Caddy reverse proxy...${NC}"
  if ! command -v caddy &>/dev/null; then
    apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
    curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg --yes
    curl -1sLF 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
    apt-get update -y
    apt-get install -y caddy
  fi

  cat <<EOF > /etc/caddy/Caddyfile
${DOMAIN} {
    reverse_proxy 127.0.0.1:1995
}
EOF
  systemctl restart caddy
  echo -e "${GREEN}[OK] Automatic SSL certificate configured for ${DOMAIN}.${NC}"
fi

# 10. Success Summary
echo -e "\n${GREEN}${BOLD}====================================================================${NC}"
echo -e "${GREEN}${BOLD}     🎉 ASTRIKCODERS SAAS DEPLOYMENT COMPLETED SUCCESSFULLY!        ${NC}"
echo -e "${GREEN}${BOLD}====================================================================${NC}"
echo ""
echo -e "🌐 ${BOLD}Application URL:${NC}       ${CYAN}${FRONTEND_URL}${NC}"
echo -e "⚡ ${BOLD}POS Screen:${NC}            ${CYAN}${FRONTEND_URL}/pos${NC}"
echo -e "🛵 ${BOLD}Delivery Board:${NC}        ${CYAN}${FRONTEND_URL}/delivery${NC}"
echo -e "👑 ${BOLD}Super Admin Panel:${NC}     ${CYAN}${FRONTEND_URL}/super-admin/login${NC}"
echo ""
echo -e "🔐 ${BOLD}Super Admin Credentials:${NC}"
echo -e "   Email:    ${YELLOW}admin@astrikcoders.com${NC}"
echo -e "   Password: ${YELLOW}${SUPER_ADMIN_PASSWORD}${NC}"
echo ""
echo -e "🍽️  ${BOLD}Demo Restaurant Owner Credentials:${NC}"
echo -e "   Email:    ${YELLOW}owner@demo.local${NC}"
echo -e "   Password: ${YELLOW}Password123!${NC}"
echo ""
echo -e "📋 ${BOLD}Useful Management Commands:${NC}"
echo -e "   View app logs:        ${CYAN}docker compose logs -f${NC}"
echo -e "   Restart stack:        ${CYAN}docker compose restart${NC}"
echo -e "   Update to latest git: ${CYAN}git pull && docker compose up -d --build${NC}"
echo -e "   Stop all containers:  ${CYAN}docker compose down${NC}"
echo ""
echo -e "${GREEN}====================================================================${NC}"
