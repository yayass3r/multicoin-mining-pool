# ⛏️ MultiCoin Mining Pool - الإنتاج

## 📊 نظرة عامة

حوض تعدين متعدد العملات يدعم:
- **KAS (Kaspa)** - خوارزمية kHeavyHash
- **RVN (Ravencoin)** - خوارزمية KawPoW
- **ALPH (Alephium)** - خوارزمية Blake3

## 🚀 طرق النشر

### الطريقة 1: Render.com (مجاني)

1. اربط المشروع بـ GitHub
2. استخدم `render.yaml` للنشر التلقائي
3. سيتم إنشاء:
   - Web Service للوحة التحكم
   - Redis للإحصائيات

### الطريقة 2: Docker Compose (VPS)

```bash
# النشر على خادم VPS
cd docker
docker-compose up -d
```

هذا سيقوم بتشغيل:
- عقد Kaspa الكاملة
- عقد Ravencoin الكاملة
- عقد Alephium الكاملة
- Redis للإحصائيات
- خادم التعدين Pool

## 📁 هيكل المشروع

```
├── server.js                    # خادم التعدين الرئيسي
├── src/
│   ├── app/
│   │   └── page.tsx            # لوحة التحكم
│   └── lib/
│       ├── rpc/
│       │   ├── base-rpc.ts     # الفئة الأساسية RPC
│       │   ├── kaspa-rpc.ts    # عميل Kaspa
│       │   ├── ravencoin-rpc.ts # عميل Ravencoin
│       │   └── alephium-rpc.ts # عميل Alephium
│       ├── redis/
│       │   └── stats-manager.ts # إدارة الإحصائيات
│       ├── mining-pool-config.ts # إعدادات المحافظ
│       └── production-config.ts  # إعدادات الإنتاج
└── docker/
    ├── docker-compose.yml      # Docker Compose
    └── Dockerfile              # صورة Docker
```

## 💼 المحافظ

| العملة | العنوان |
|--------|---------|
| KAS | `kaspa:qppxt0expwdg4vra08709ancu4t5stldmc3hdfm4xdschq3whvvqwnr9y7v86` |
| RVN | `REFRuSaC8iHeKMeUiMg3MEJUKfUD1hmv5Y` |
| ALPH | `1DJ5UX4BknPeDcwB9C3EzNGZcF9EBG5UdYAKdeWbDGz5b` |

## 🔗 الاتصال بالحوض

### Kaspa (KAS)
```bash
./ksminer --pool stratum+tcp://pool.multicoin.com:3333 --wallet YOUR_WALLET --worker worker1
```

### Ravencoin (RVN)
```bash
./t-rex -a kawpow -o stratum+tcp://pool.multicoin.com:3334 -u YOUR_WALLET -p x
```

### Alephium (ALPH)
```bash
./lolMiner -a BLAKE3 -o stratum+tcp://pool.multicoin.com:3336 -u YOUR_WALLET -p x
```

## 📊 APIs

| Endpoint | Description |
|----------|-------------|
| `/api/health` | Health check |
| `/api/live-stats` | إحصائيات حية |
| `/api/pool/config` | إعدادات الحوض |
| `/api/pool/connect` | تعليمات الاتصال |
| `/api/mining/start` | بدء التعدين |
| `/api/mining/status` | حالة التعدين |

## ⚙️ متغيرات البيئة

```env
# المحافظ
KAS_WALLET=kaspa:qpp...
RVN_WALLET=R...
ALPH_WALLET=1...

# عقد Kaspa
KASPA_RPC_HOST=127.0.0.1
KASPA_RPC_PORT=16110
KASPA_RPC_USER=kaspa_rpc
KASPA_RPC_PASS=your_password

# عقد Ravencoin
RAVEN_RPC_HOST=127.0.0.1
RAVEN_RPC_PORT=8766
RAVEN_RPC_USER=raven_rpc
RAVEN_RPC_PASS=your_password

# عقد Alephium
ALEPHIUM_API_HOST=127.0.0.1
ALEPHIUM_API_PORT=12973
ALEPHIUM_API_KEY=your_api_key

# Redis
REDIS_URL=redis://localhost:6379
```

## 🛠️ التطوير

```bash
# تثبيت المتطلبات
bun install

# تشغيل في وضع التطوير
bun run dev

# بناء للإنتاج
bun run build

# تشغيل الخادم
bun run server.js
```

## 📈 الميزات

- ✅ تعدين 24/7 تلقائي
- ✅ لوحة تحكم حية
- ✅ دعم متعدد العملات
- ✅ نظام Keep-Alive
- ✅ Redis للإحصائيات
- ✅ Docker Compose
- ✅ نشر Render.com

## 📜 الرخصة

MIT License

---

**⛏️ MultiCoin Mining Pool - تعدين 24/7**
