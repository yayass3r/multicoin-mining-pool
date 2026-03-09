# 🚀 دليل نشر حوض التعدين على VPS

## 📋 المتطلبات

| المتطلب | الحد الأدنى | المُوصى به |
|---------|------------|-----------|
| **CPU** | 4 أنوية | 8+ أنوية |
| **RAM** | 8 GB | 16-32 GB |
| **Disk** | 500 GB SSD | 1 TB NVMe |
| **Network** | 100 Mbps | 1 Gbps |
| **OS** | Ubuntu 20.04/22.04 | Ubuntu 22.04 LTS |

---

## ⚡ التثبيت السريع (نقرة واحدة)

```bash
# تشغيل سكريبت التثبيت التلقائي
curl -fsSL https://raw.githubusercontent.com/yayass3r/multicoin-mining-pool/main/vps-deploy/install.sh | bash
```

---

## 📦 التثبيت اليدوي خطوة بخطوة

### 1️⃣ تحديث النظام

```bash
sudo apt update && sudo apt upgrade -y
```

### 2️⃣ تثبيت Docker

```bash
# تثبيت Docker
curl -fsSL https://get.docker.com | sh

# تثبيت Docker Compose
sudo apt install docker-compose-plugin -y

# إضافة المستخدم لمجموعة Docker
sudo usermod -aG docker $USER
newgrp docker
```

### 3️⃣ تثبيت Node.js و Bun

```bash
# تثبيت Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# تثبيت Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

### 4️⃣ تثبيت Redis

```bash
sudo apt install -y redis-server

# تكوين Redis
sudo sed -i 's/bind 127.0.0.1/bind 0.0.0.0/' /etc/redis/redis.conf
sudo sed -i 's/# maxmemory <bytes>/maxmemory 4gb/' /etc/redis/redis.conf

sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### 5️⃣ استنساخ المشروع

```bash
git clone https://github.com/yayass3r/multicoin-mining-pool.git
cd multicoin-mining-pool
bun install
bun run build
```

### 6️⃣ إنشاء ملف البيئة

```bash
cat > .env << 'EOF'
NODE_ENV=production
PORT=10000
HOST=0.0.0.0

# غيّر هذه المحافظ!
KAS_WALLET=kaspa:qppxt0expwdg4vra08709ancu4t5stldmc3hdfm4xdschq3whvvqwnr9y7v86
RVN_WALLET=REFRuSaC8iHeKMeUiMg3MEJUKfUD1hmv5Y
ALPH_WALLET=1DJ5UX4BknPeDcwB9C3EzNGZcF9EBG5UdYAKdeWbDGz5b

REDIS_URL=redis://localhost:6379

# غيّر كلمات المرور!
KASPA_RPC_USER=kaspa_rpc
KASPA_RPC_PASS=YOUR_SECURE_PASSWORD
RAVEN_RPC_USER=raven_rpc
RAVEN_RPC_PASS=YOUR_SECURE_PASSWORD
ALEPHIUM_API_KEY=YOUR_API_KEY
EOF
```

### 7️⃣ إعداد جدار الحماية

```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 10000/tcp   # Dashboard
sudo ufw allow 3333/tcp    # KAS Stratum
sudo ufw allow 3334/tcp    # RVN Stratum
sudo ufw allow 3336/tcp    # ALPH Stratum
sudo ufw --force enable
```

### 8️⃣ تشغيل العقد الكاملة (اختياري)

```bash
cd docker

# تشغيل الكل
docker compose up -d

# أو تشغيل عقدة واحدة
docker compose up -d kaspad
docker compose up -d ravend
docker compose up -d alephium
```

### 9️⃣ تشغيل الحوض

```bash
# باستخدام systemd (مُوصى)
sudo cp vps-deploy/mining-pool.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable mining-pool
sudo systemctl start mining-pool

# أو مباشرة
bun run server.js
```

---

## 🔌 المنافذ

| الخدمة | المنفذ | الوصف |
|--------|--------|-------|
| Dashboard | 10000 | لوحة التحكم |
| KAS Stratum | 3333 | تعدين Kaspa |
| RVN Stratum | 3334 | تعدين Ravencoin |
| ALPH Stratum | 3336 | تعدين Alephium |
| Kaspa RPC | 16110 | عقدة Kaspa |
| Raven RPC | 8766 | عقدة Ravencoin |
| Alephium API | 12973 | عقدة Alephium |
| Redis | 6379 | الإحصائيات |

---

## ⛏️ اتصال المعدنين

### Kaspa (KAS)
```bash
# ksminer
./ksminer --pool stratum+tcp://YOUR_VPS_IP:3333 --wallet YOUR_KAS_WALLET --worker worker1

# bzminer
./bzminer -a kheavyhash -p stratum+tcp://YOUR_VPS_IP:3333 -w YOUR_KAS_WALLET -r worker1
```

### Ravencoin (RVN)
```bash
# T-Rex
./t-rex -a kawpow -o stratum+tcp://YOUR_VPS_IP:3334 -u YOUR_RVN_WALLET -p x

# Gminer
./miner -a kawpow -s stratum+tcp://YOUR_VPS_IP:3334 -u YOUR_RVN_WALLET -p x
```

### Alephium (ALPH)
```bash
# lolMiner
./lolMiner -a BLAKE3 -o stratum+tcp://YOUR_VPS_IP:3336 -u YOUR_ALPH_WALLET -p x

# bzminer
./bzminer -a blake3 -p stratum+tcp://YOUR_VPS_IP:3336 -w YOUR_ALPH_WALLET -r worker1
```

---

## 📊 المراقبة

### فحص الحالة
```bash
# حالة الخدمة
sudo systemctl status mining-pool

# السجلات
sudo journalctl -u mining-pool -f

# فحص API
curl http://localhost:10000/api/health
curl http://localhost:10000/api/live-stats
```

### أوامر الإدارة
```bash
pool-start      # بدء الحوض
pool-stop       # إيقاف الحوض
pool-status     # حالة الحوض
pool-logs       # السجلات
pool-update     # تحديث الحوض
```

---

## 🔒 الأمان

### تغيير كلمات المرور
```bash
# تعديل ملف البيئة
nano /opt/mining-pool/.env

# إعادة تشغيل
sudo systemctl restart mining-pool
```

### شهادة SSL
```bash
# تثبيت Certbot
sudo apt install certbot python3-certbot-nginx

# الحصول على شهادة
sudo certbot --nginx -d your-domain.com
```

### إعداد Nginx
```bash
# تثبيت Nginx
sudo apt install nginx

# تكوين Reverse Proxy
sudo nano /etc/nginx/sites-available/mining-pool

# تفعيل
sudo ln -s /etc/nginx/sites-available/mining-pool /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 💰 الأرباح

### رسوم الحوض
- **رسوم الحوض**: 1%
- **الحد الأدنى للسحب**:
  - KAS: 1.0
  - RVN: 10.0
  - ALPH: 0.5

### نظام الدفع
- **النوع**: PPLNS (Pay Per Last N Shares)
- **الفترة**: كل ساعة تلقائياً
- **التأكيدات**: KAS=10, RVN=60, ALPH=5

---

## 🚨 استكشاف الأخطاء

### الحوض لا يعمل
```bash
# فحص السجلات
sudo journalctl -u mining-pool -n 100

# فحص المنافذ
sudo netstat -tlnp | grep -E '3333|3334|3336|10000'

# فحص Redis
redis-cli ping
```

### المعدنون لا يتصلون
```bash
# فحص جدار الحماية
sudo ufw status

# فحص Stratum
telnet localhost 3333
```

### العقد لا تتزامن
```bash
# فحص حالة Docker
docker ps
docker logs kaspad-node
docker logs ravend-node
docker logs alephium-node
```

---

## 📞 الدعم

- **GitHub**: https://github.com/yayass3r/multicoin-mining-pool
- **Issues**: https://github.com/yayass3r/multicoin-mining-pool/issues

---

**⛏️ حوض التعدين يعمل 24/7 تلقائياً!**
