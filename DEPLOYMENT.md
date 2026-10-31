# 🚀 Astrikcoders SaaS - Hostinger VPS Deployment Guide

This guide walks you through deploying the **Astrikcoders Multi-Tenant Restaurant Management SaaS** on an **Ubuntu VPS (Hostinger, DigitalOcean, Hetzner, AWS, etc.)** using our automated one-click installer.

---

## 📋 Requirements
- **Server:** Ubuntu 22.04 or 24.04 64-bit (Hostinger KVM 1, KVM 2, or any VPS)
- **Minimum Specs:** 2 vCPU, 4 GB RAM, 20 GB SSD
- **Recommended Specs:** 4 vCPU, 8 GB RAM, 50 GB NVMe
- **Domain (Optional but recommended):** e.g., `pos.yourdomain.com` or `app.yourdomain.com`

---

## ⚡ 1-Click Fast Deployment

### Step 1: Point your Domain to your VPS IP
In your domain registrar (Hostinger, Cloudflare, GoDaddy, Namecheap):
- Add an **A Record**:
  - **Host:** `pos` (or `@` for root domain)
  - **Points to / Value:** `<YOUR_HOSTINGER_VPS_IP>`
  - **TTL:** Automatic or 300 seconds

---

### Step 2: Connect to your VPS via SSH
Open your terminal (or PuTTY / Windows Terminal) and connect to your VPS:
```bash
ssh root@YOUR_VPS_IP
```

---

### Step 3: Clone & Run the Deployer
Copy and paste this single command block into your VPS terminal:

```bash
git clone https://github.com/Arnab-34/saas-resturant-management-system.git /opt/astrikcoders && cd /opt/astrikcoders && chmod +x deploy.sh && sudo ./deploy.sh
```

---

### Step 4: Follow the On-Screen Prompts
The installer will prompt you:
1. **Domain Name:** Enter your domain (e.g. `pos.yourdomain.com`) or press `ENTER` to use your server IP.
2. **Automatic SSL (HTTPS):** Type `y` to enable automatic free Let's Encrypt SSL.

The script handles everything else automatically:
- Installs Docker & Docker Compose
- Configures firewall rules (Ports 22, 80, 443, 1995)
- Generates secure cryptographic tokens (`JWT_SECRET`, `SUPER_ADMIN_JWT_SECRET`, `POSTGRES_PASSWORD`)
- Launches PostgreSQL 16, NestJS Backend, and Next.js Web containers
- Executes database schema migrations and triggers
- Seeds default restaurant data and creates your **Super Admin** account
- Configures Caddy automated SSL reverse proxy

---

## 🔐 Default Access & Credentials

Once installation completes, the script displays your credentials:

### 👑 Super Admin Platform Panel
- **URL:** `https://your-domain.com/super-admin/login` (or `http://YOUR_VPS_IP:1995/super-admin/login`)
- **Email:** `admin@astrikcoders.com`
- **Password:** *(Printed by the installer at the end of setup)*

### 🍽️ Demo Restaurant Owner Account
- **URL:** `https://your-domain.com/login` (or `http://YOUR_VPS_IP:1995/login`)
- **Email:** `owner@demo.local`
- **Password:** `Password123!`

---

## 🛠️ Management & Maintenance Commands

All commands are run from the `/opt/astrikcoders` directory:

### View Live Logs
```bash
cd /opt/astrikcoders
docker compose logs -f
# Or view a specific container:
docker compose logs -f web
docker compose logs -f backend
```

### Restart All Services
```bash
cd /opt/astrikcoders
docker compose restart
```

### Update to Latest Version
When you push code updates to GitHub:
```bash
cd /opt/astrikcoders
git pull
docker compose up -d --build
```

### Create a Database Backup
```bash
cd /opt/astrikcoders
docker compose exec -T postgres pg_dump -U nodedr -d nodedr_restaurant > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore a Database Backup
```bash
docker compose exec -T postgres psql -U nodedr -d nodedr_restaurant < your_backup.sql
```

---

## ❓ Troubleshooting

| Issue | Solution |
| :--- | :--- |
| **Domain shows "Connection Refused"** | Make sure your DNS `A` record has propagated to your VPS IP (`ping your-domain.com`). |
| **"Unauthorized" after login** | If using HTTPS, ensure `COOKIE_SECURE=true` in `.env`. If using plain HTTP via IP, ensure `COOKIE_SECURE=false`. |
| **Firewall blocking ports** | Run `sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw allow 1995 && sudo ufw reload`. |
| **Database container restarting** | Run `docker compose logs postgres` to view error logs. |

---

## 🏢 Adding New Tenants (Restaurants)
1. Log in to the Super Admin panel: `/super-admin/login`
2. Click **Tenants** ➔ **Create New Tenant**
3. Fill in restaurant name, owner email, initial password, and select subscription tier (**Starter**, **Professional**, or **Enterprise**).
4. The tenant owner can now log in at `/login` and access their customized POS, KDS, tables, inventory, and delivery dispatch!
