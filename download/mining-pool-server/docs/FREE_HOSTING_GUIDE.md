# =====================================================
# دليل الاستضافة المجانية لحوض التعدين
# Free Hosting Guide for Mining Pool
# =====================================================

## ⚠️ تحذير مهم

**تشغيل حوض تعدين عملات يتطلب موارد عالية جداً:**
- وحدة المعالجة المركزية (CPU): 4+ نوى
- الذاكرة العشوائية (RAM): 8+ جيجابايت
- التخزين: 100+ جيجابايت SSD
- النطاق الترددي: غير محدود

**الخوادم المجانية محدودة جداً ولن تكون كافية لإنتاج حقيقي!**

---

## 🏆 أفضل المنصات السحابية المجانية (Always Free)

### 1. Oracle Cloud (الأفضل - موصى به)

**الموارد المجانية:**
- 4 OCPUs (ARM)
- 24 جيجابايت RAM
- 200 جيجابايت تخزين
- 10 تيرابايت نقل بيانات/شهر

**خطوات الإعداد:**

```bash
# 1. إنشاء حساب على Oracle Cloud
# https://signup.cloud.oracle.com

# 2. إنشاء مثيل VM.Standard.A1.Flex
# اختر: 4 OCPUs, 24GB RAM

# 3. الاتصال بالخادم
ssh -i your_key.pem ubuntu@your-instance-ip

# 4. تحديث النظام
sudo apt update && sudo apt upgrade -y

# 5. تثبيت Docker و Docker Compose
sudo apt install -y docker.io docker-compose

# 6. إضافة المستخدم لمجموعة Docker
sudo usermod -aG docker $USER

# 7. إعادة تسجيل الدخول
exit
# ثم أعد الاتصال

# 8. تثبيت Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 9. تثبيت Redis
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server

# 10. تثبيت PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql

# 11. إنشاء قاعدة البيانات
sudo -u postgres psql
CREATE DATABASE mining_pool;
CREATE USER pool_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE mining_pool TO pool_user;
\q
```

---

### 2. Google Cloud Platform (GCP)

**الموارد المجانية:**
- e2-micro (2 vCPU, 1GB RAM)
- 30 جيجابايت تخزين قياسي
- 1 جيجابايت نقل بيانات/شهر

**خطوات الإعداد:**

```bash
# 1. إنشاء حساب GCP
# https://cloud.google.com/free

# 2. إنشاء مشروع جديد

# 3. إنشاء VM Instance
gcloud compute instances create mining-pool \
    --machine-type=e2-micro \
    --zone=us-central1-a \
    --image-family=ubuntu-2204-lts \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=30GB

# 4. الاتصال بالخادم
gcloud compute ssh mining-pool --zone=us-central1-a

# 5. تثبيت الاعتماديات
sudo apt update && sudo apt install -y docker.io docker-compose nodejs npm redis-server postgresql
```

---

### 3. AWS (Amazon Web Services)

**الموارد المجانية (Free Tier لمدة 12 شهر):**
- t2.micro أو t3.micro
- 30 جيجابايت EBS
- 15 جيجابايت نقل بيانات/شهر

**خطوات الإعداد:**

```bash
# 1. إنشاء حساب AWS
# https://aws.amazon.com/free

# 2. إطلاق EC2 Instance
# اختر Amazon Linux 2 أو Ubuntu 22.04

# 3. الاتصال بالخادم
ssh -i your-key.pem ec2-user@your-instance-ip

# 4. تثبيت الاعتماديات
sudo yum update -y  # Amazon Linux
sudo yum install -y docker nodejs npm postgresql-server

# أو لأوبونتو:
sudo apt update && sudo apt install -y docker.io nodejs npm postgresql
```

---

### 4. Azure (Microsoft)

**الموارد المجانية:**
- B1s VM (1 vCPU, 1GB RAM)
- 64 جيجابايت تخزين
- 5 جيجابايت نقل بيانات/شهر

---

## 🚀 خطوات نشر حوض التعدين

### الطريقة الأولى: باستخدام Docker (موصى به)

```bash
# 1. استنساخ المشروع
git clone https://github.com/your-repo/mining-pool.git
cd mining-pool

# 2. تعديل ملف الإعدادات
nano config/pool.config.json

# 3. تشغيل Docker Compose
docker-compose -f docker/docker-compose.yml up -d

# 4. التحقق من الحالة
docker-compose -f docker/docker-compose.yml ps
docker-compose -f docker/docker-compose.yml logs -f
```

### الطريقة الثانية: النشر اليدوي

```bash
# 1. تثبيت Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 2. تثبيت PM2 لإدارة العمليات
sudo npm install -g pm2

# 3. استنساخ المشروع
git clone https://github.com/your-repo/mining-pool.git
cd mining-pool

# 4. تثبيت الاعتماديات
npm install

# 5. بناء المشروع
npm run build

# 6. تشغيل الخادم
pm2 start dist/pool/MultiCoinPoolManager.js --name mining-pool

# 7. حفظ إعدادات PM2
pm2 save
pm2 startup

# 8. مراقبة السجلات
pm2 logs mining-pool
```

---

## 📦 تثبيت عُقد العملات (Coin Nodes)

### 1. عقدة Kaspa (KAS)

```bash
# تثبيت Kaspad
git clone https://github.com/kaspanet/kaspad
cd kaspad
go build ./...

# تشغيل العقدة
./kaspad --utxoindex --listen 127.0.0.1:16110

# أو استخدام Docker
docker run -d \
    --name kaspad \
    -p 16110:16110 \
    -v kaspad-data:/app/data \
    kaspanet/kaspad:latest \
    --utxoindex
```

### 2. عقدة Ravencoin (RVN)

```bash
# تحميل Ravencoin
wget https://github.com/RavenProject/Ravencoin/releases/download/v4.3.2.1/ravencoin-4.3.2.1-x86_64-linux-gnu.tar.gz
tar -xzf ravencoin-4.3.2.1-x86_64-linux-gnu.tar.gz
cd ravencoin-4.3.2.1/bin

# إنشاء ملف التكوين
mkdir -p ~/.raven
cat > ~/.raven/raven.conf << EOF
server=1
rpcuser=your_rpc_user
rpcpassword=your_rpc_password
rpcallowip=127.0.0.1
rpcport=8766
listen=1
txindex=1
EOF

# تشغيل العقدة
./ravend -daemon
```

### 3. عقدة Zephyr Protocol (ZEPH)

```bash
# تثبيت Zephyr
git clone https://github.com/ZephyrProtocol/zephyr.git
cd zephyr
git checkout master
git submodule update --init --recursive
make

# تشغيل العقدة
./build/release/bin/zephyrd

# أو باستخدام Docker
docker run -d \
    --name zephyrd \
    -p 18081:18081 \
    -v zephyr-data:/home/zephyr/.zephyr \
    zephyrprotocol/zephyr:latest
```

### 4. عقدة Alephium (ALPH)

```bash
# تحميل Alephium
wget https://github.com/alephium/alephium/releases/download/v2.6.2/alephium-2.6.2.jar

# تشغيل العقدة
java -jar alephium-2.6.2.jar

# أو باستخدام Docker
docker run -d \
    --name alephium \
    -p 12973:12973 \
    -v alephium-data:/alephium-home/.alephium \
    alephium/alephium:latest
```

---

## 🔒 الأمان والحماية

### 1. إعداد الجدار الناري

```bash
# تثبيت UFW
sudo apt install -y ufw

# السماح بالاتصالات المطلوبة
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 3333:3336/tcp  # Stratum ports
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 2. إعداد SSL/TLS

```bash
# تثبيت Certbot
sudo apt install -y certbot python3-certbot-nginx

# الحصول على شهادة SSL
sudo certbot --nginx -d your-domain.com

# التجديد التلقائي
sudo certbot renew --dry-run
```

### 3. حماية Redis

```bash
# تحرير ملف التكوين
sudo nano /etc/redis/redis.conf

# أضف/عدّل:
bind 127.0.0.1
requirepass your_strong_password
protected-mode yes

# إعادة تشغيل Redis
sudo systemctl restart redis-server
```

---

## 📊 المراقبة والتنبيهات

### 1. تثبيت Prometheus و Grafana

```bash
# إضافة مستودع Grafana
sudo apt install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -

# تثبيت
sudo apt update
sudo apt install -y prometheus grafana

# تشغيل
sudo systemctl enable prometheus grafana-server
sudo systemctl start prometheus grafana-server
```

### 2. تكوين التنبيهات

```yaml
# /etc/prometheus/alert.rules.yml
groups:
  - name: mining_pool_alerts
    rules:
      - alert: PoolDown
        expr: up{job="mining-pool"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Mining pool is down"

      - alert: LowHashrate
        expr: pool_hashrate < 100000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Pool hashrate is low"
```

---

## 💰 تكاليف تقديرية للإنتاج

| المكون | المواصفات | التكلفة الشهرية |
|--------|-----------|-----------------|
| خادم Stratum | 8 CPU, 32GB RAM | $100-200 |
| خادم API | 4 CPU, 16GB RAM | $50-100 |
| قاعدة البيانات | 100GB SSD | $20-50 |
| Redis | 8GB RAM | $20-30 |
| عُقد العملات | 4-8 CPU, 32GB RAM | $150-300 |
| النطاق الترددي | 10TB | $50-100 |
| **المجموع** | | **$400-800/شهر** |

---

## 📝 ملاحظات ختامية

1. **الخوادم المجانية مناسبة فقط للاختبار والتطوير**
2. **للإنتاج الحقيقي، استخدم خوادم مخصصة أو VPS قوية**
3. **تأكد من الامتثال للقوانين المحلية**
4. **احتفظ بنسخ احتياطية منتظمة**
5. **راقب الموارد باستمرار**
