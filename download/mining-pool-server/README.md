# 🔨 MultiCoin Mining Pool

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Coins](https://img.shields.io/badge/coins-4-orange)

**حوض تعدين متعدد العملات احترافي**

يدعم: **Kaspa (KAS)** | **Ravencoin (RVN)** | **Zephyr Protocol (ZEPH)** | **Alephium (ALPH)**

</div>

---

## 📋 المحتويات

- [نظرة عامة](#نظرة-عامة)
- [العملات المدعومة](#العملات-المدعومة)
- [المتطلبات](#المتطلبات)
- [التثبيت](#التثبيت)
- [الإعدادات](#الإعدادات)
- [عناوين المحافظ](#عناوين-المحافظ)
- [أوامر الاتصال](#أوامر-الاتصال)
- [الاستضافة المجانية](#الاستضافة-المجانية)
- [الأمان](#الأمان)

---

## 🎯 نظرة عامة

هذا المشروع يوفر:
- ✅ خادم **Stratum** يدعم 4 خوارزميات تعدين
- ✅ لوحة تحكم **Dashboard** تفاعلية
- ✅ نظام **دفع تلقائي** للمعدنين
- ✅ إحصائيات **مباشرة** في الوقت الفعلي
- ✅ دعم **Docker** للنشر السريع

---

## 💰 العملات المدعومة

| العملة | الرمز | الخوارزمية | منفذ Stratum | مكافأة الكتلة |
|--------|-------|------------|--------------|---------------|
| Kaspa | KAS | kHeavyHash | 3333 | 10 KAS |
| Ravencoin | RVN | KawPoW | 3334 | 2500 RVN |
| Zephyr Protocol | ZEPH | RandomX | 3335 | 2.5 ZEPH |
| Alephium | ALPH | Blake3 | 3336 | 3 ALPH |

---

## ⚙️ المتطلبات

### متطلبات النظام (للإنتاج)

```
CPU: 4+ نوى (يُفضل 8+)
RAM: 8 جيجابايت (يُفضل 16+)
التخزين: 100+ جيجابايت SSD
الشبكة: اتصال مستقر عالي السرعة
```

### البرمجيات المطلوبة

```bash
# Node.js 20+
node --version  # v20.0.0+

# PostgreSQL 15+
psql --version

# Redis 7+
redis-server --version

# Docker (اختياري)
docker --version
docker-compose --version
```

---

## 🚀 التثبيت

### الطريقة الأولى: Docker (موصى به)

```bash
# 1. استنساخ المشروع
git clone https://github.com/your-repo/mining-pool.git
cd mining-pool

# 2. تعديل الإعدادات
nano config/pool.config.json

# 3. تشغيل الحاويات
docker-compose -f docker/docker-compose.yml up -d

# 4. مراقبة السجلات
docker-compose -f docker/docker-compose.yml logs -f
```

### الطريقة الثانية: النشر اليدوي

```bash
# 1. تثبيت الاعتماديات
npm install

# 2. بناء المشروع
npm run build

# 3. تشغيل الخادم
npm run start

# أو باستخدام PM2
pm2 start dist/pool/MultiCoinPoolManager.js --name mining-pool
```

---

## ⚙️ الإعدادات

### ملف الإعدادات الرئيسي

```json
// config/pool.config.json
{
  "pool": {
    "name": "MultiCoin Mining Pool",
    "version": "1.0.0"
  },
  "wallets": {
    "KAS": {
      "address": "kaspa:qp0nl57r2t2mntlan756383khkukmjf8z7nstl066aqdr0xcjj8n54vstafuj",
      "fee": 1.0,
      "minPayout": 100
    },
    "RVN": {
      "address": "REFRuSaC8iHeKMeUiMg3MEJUKfUD1hmv5Y",
      "fee": 1.0,
      "minPayout": 10
    },
    "ZEPH": {
      "address": "TO_BE_ADDED",
      "fee": 1.0,
      "minPayout": 0.1
    },
    "ALPH": {
      "address": "1DJ5UX4BknPeDcwB9C3EzNGZcF9EBG5UdYAKdeWbDGz5b",
      "fee": 1.0,
      "minPayout": 1
    }
  }
}
```

---

## 💼 عناوين المحافظ

### أين أضع عناوين محافظي؟

عناوين المحافظ توضع في ملف **`config/pool.config.json`** في قسم **`wallets`**:

```json
{
  "wallets": {
    "KAS": {
      "address": "kaspa:YOUR_KAS_WALLET_HERE",
      "fee": 1.0,
      "minPayout": 100
    },
    "RVN": {
      "address": "YOUR_RVN_WALLET_HERE",
      "fee": 1.0,
      "minPayout": 10
    },
    "ZEPH": {
      "address": "YOUR_ZEPH_WALLET_HERE",
      "fee": 1.0,
      "minPayout": 0.1
    },
    "ALPH": {
      "address": "YOUR_ALPH_WALLET_HERE",
      "fee": 1.0,
      "minPayout": 1
    }
  }
}
```

### المحافظ المُعدّة حالياً:

| العملة | العنوان |
|--------|---------|
| **KAS** | `kaspa:qp0nl57r2t2mntlan756383khkukmjf8z7nstl066aqdr0xcjj8n54vstafuj` |
| **RVN** | `REFRuSaC8iHeKMeUiMg3MEJUKfUD1hmv5Y` |
| **ZEPH** | `TO_BE_ADDED` ⚠️ (يحتاج إضافة) |
| **ALPH** | `1DJ5UX4BknPeDcwB9C3EzNGZcF9EBG5UdYAKdeWbDGz5b` |

---

## 🔌 أوامر الاتصال للمعدنين

### Kaspa (KAS) - kHeavyHash

```bash
# T-Rex Miner
t-rex -a kheavyhash -o stratum+tcp://your-pool.com:3333 -u YOUR_KAS_WALLET -p x

# BzMiner
bzminer -a kheavyhash -w YOUR_KAS_WALLET -p stratum+tcp://your-pool.com:3333
```

### Ravencoin (RVN) - KawPoW

```bash
# T-Rex Miner
t-rex -a kawpow -o stratum+tcp://your-pool.com:3334 -u YOUR_RVN_WALLET -p x

# NBMiner
nbminer -a kawpow -o stratum+tcp://your-pool.com:3334 -u YOUR_RVN_WALLET
```

### Zephyr Protocol (ZEPH) - RandomX

```bash
# XMRig
xmrig -o your-pool.com:3335 -u YOUR_ZEPH_WALLET -p x --coin zephyr

# SRBMiner
SRBMiner-MULTI --algorithm randomx --pool your-pool.com:3335 --wallet YOUR_ZEPH_WALLET
```

### Alephium (ALPH) - Blake3

```bash
# T-Rex Miner
t-rex -a blake3 -o stratum+tcp://your-pool.com:3336 -u YOUR_ALPH_WALLET -p x

# BzMiner
bzminer -a blake3 -w YOUR_ALPH_WALLET -p stratum+tcp://your-pool.com:3336
```

---

## 🆓 الاستضافة المجانية

### أفضل الخيارات

| المنصة | الموارد المجانية | المدة | التوصية |
|--------|------------------|-------|---------|
| **Oracle Cloud** | 4 CPU, 24GB RAM | دائم | ⭐⭐⭐⭐⭐ |
| Google Cloud | 1 CPU, 1GB RAM | دائم | ⭐⭐ |
| AWS | 1 CPU, 1GB RAM | 12 شهر | ⭐⭐ |
| Azure | 1 CPU, 1GB RAM | 12 شهر | ⭐⭐ |

### إعداد Oracle Cloud (الأفضل)

```bash
# 1. إنشاء حساب على oracle.com/cloud/free

# 2. إنشاء مثيل VM.Standard.A1.Flex

# 3. الاتصال وتثبيت المتطلبات
ssh ubuntu@your-instance-ip

sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose nodejs npm redis-server postgresql

# 4. نشر الحوض
git clone https://github.com/your-repo/mining-pool.git
cd mining-pool
docker-compose -f docker/docker-compose.yml up -d
```

> ⚠️ **تحذير**: الخوادم المجانية مناسبة فقط للاختبار، وليست للإنتاج!

---

## 🔒 الأمان

### إعداد الجدار الناري

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 3333:3336/tcp  # Stratum
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### حماية Redis

```bash
sudo nano /etc/redis/redis.conf

# أضف:
bind 127.0.0.1
requirepass YOUR_STRONG_PASSWORD
protected-mode yes

sudo systemctl restart redis-server
```

---

## 📁 هيكل المشروع

```
mining-pool/
├── config/
│   ├── pool.config.json      # الإعدادات الرئيسية
│   └── wallets.example.json  # مثال للمحافظ
├── stratum/
│   └── StratumServer.ts      # خادم Stratum
├── pool/
│   └── MultiCoinPoolManager.ts
├── scripts/
│   └── init-db.sql          # قاعدة البيانات
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
└── docs/
    └── FREE_HOSTING_GUIDE.md
```

---

## 🤝 المساهمة

نرحب بالمساهمات! يرجى:
1. Fork المشروع
2. إنشاء فرع جديد (`git checkout -b feature/amazing`)
3. Commit التغييرات (`git commit -m 'Add amazing feature'`)
4. Push للفرع (`git push origin feature/amazing`)
5. فتح Pull Request

---

## 📄 الترخيص

هذا المشروع مرخص تحت [MIT License](LICENSE).

---

## ⚠️ إخلاء المسؤولية

- هذا المشروع للأغراض التعليمية والتجريبية
- التعدين ينطوي على مخاطر مالية
- تأكد من الامتثال للقوانين المحلية
- استثمر بمسؤولية

---

<div align="center">

**صنع بـ ❤️ للمجتمع العربي**

</div>
