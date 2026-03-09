# ⛏️ Kaspa Mining Pool Core - الإصدار الحقيقي

> **تم التحويل من محاكاة إلى نظام حقيقي متصل بالشبكة الرئيسية**

---

## 📋 جدول المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [المتطلبات](#المتطلبات)
3. [تثبيت Kaspa Node](#تثبيت-kaspa-node)
4. [هيكل المشروع](#هيكل-المشروع)
5. [الأكواد الرئيسية](#الأكواد-الرئيسية)
6. [التشغيل](#التشغيل)
7. [التحقق من العمل](#التحقق-من-العمل)

---

## 🌐 نظرة عامة

هذا المشروع يحتوي على:

| المكون | الوصف |
|--------|-------|
| **Kaspa RPC Client** | اتصال حقيقي بـ Kaspa Node عبر gRPC |
| **kHeavyHash** | خوارزمية التشفير الحقيقية |
| **Share Validator** | التحقق الرياضي الدقيق من الشير |
| **Stratum Server** | خادم التعدين لأجهزة ASIC |

---

## 📦 المتطلبات

### على السيرفر:

```bash
# النظام
Ubuntu 22.04 LTS أو أحدث
8 GB RAM (الأقل)
50 GB SSD (للبيانات)

# البرمجيات
Node.js >= 18
TypeScript
Git
```

---

## ⛓️ تثبيت Kaspa Node

### الأمر الدقيق لتشغيل Kaspa Full Node:

```bash
# 1️⃣ تحميل السكريبت
wget https://raw.githubusercontent.com/your-repo/install-kaspa.sh
chmod +x install-kaspa.sh

# 2️⃣ تشغيل التثبيت
sudo ./install-kaspa.sh

# أو يدوياً:

# تحميل kaspad
wget https://github.com/kaspanet/kaspad/releases/download/v0.13.4/kaspad-v0.13.4-linux-amd64.zip
unzip kaspad-v0.13.4-linux-amd64.zip

# تشغيل العقدة
./kaspad --rpclisten=127.0.0.1:16110 \
         --listen=:16111 \
         --datadir=/var/lib/kaspa \
         --logdir=/var/log/kaspa

# التحقق من المزامنة
curl -s http://127.0.0.1:16110/api/v1/info | jq .
```

### إنشاء خدمة نظام (Systemd):

```bash
# إنشاء ملف الخدمة
sudo tee /etc/systemd/system/kaspad.service > /dev/null <<EOF
[Unit]
Description=Kaspa Full Node
After=network.target

[Service]
Type=simple
User=kaspa
ExecStart=/opt/kaspa/kaspad --configfile=/opt/kaspa/kaspad.conf
Restart=on-failure
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

# تفعيل وتشغيل
sudo systemctl daemon-reload
sudo systemctl enable kaspad
sudo systemctl start kaspad

# مراقبة
sudo journalctl -u kaspad -f
```

---

## 📁 هيكل المشروع

```
mining-core/
├── kaspa-rpc/
│   ├── kaspa-client.ts       # 🌐 اتصال RPC
│   └── protos/
│       └── rpc.proto          # 📋 تعريف gRPC
├── heavyhash/
│   └── kheavyhash.ts         # 🔐 الخوارزمية
├── validators/
│   └── share-validator.ts    # ✅ التحقق من الشير
├── stratum/
│   └── kaspa-stratum-server.ts # ⛏️ خادم التعدين
├── scripts/
│   └── install-kaspa-node.sh # 📜 سكريبت التثبيت
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🔧 الأكواد الرئيسية

### 1️⃣ الاتصال بالعقدة (RPC Integration)

```typescript
import { KaspaRPCClient } from './kaspa-rpc/kaspa-client';

// إنشاء العميل
const kaspaClient = new KaspaRPCClient('127.0.0.1:16110');

// الاتصال
await kaspaClient.initialize();

// جلب قالب الكتلة
const template = await kaspaClient.getBlockTemplate(
    'kaspa:qppxt0expwdg4vra08709ancu4t5stldmc3hdfm4xdschq3whvvqwnr9y7v86'
);

console.log('📦 Block Template:', template.header);
```

### 2️⃣ خوارزمية kHeavyHash

```typescript
import { KHeavyHash } from './heavyhash/kheavyhash';

// حساب Hash من Block Header
const header = {
    version: 1,
    parents: ['...'],
    hashMerkleRoot: '...',
    acceptedIdMerkleRoot: '...',
    utxoCommitment: '...',
    timestamp: Date.now(),
    bits: 0x1b0404cb,
    nonce: 12345678,
    daaScore: BigInt(123456)
};

const result = KHeavyHash.hashBlockHeader(header);

console.log('🔢 Hash:', result.hash);
console.log('✅ Valid:', result.isValid);
console.log('🎯 Target:', result.target);
```

### 3️⃣ التحقق من الشير

```typescript
import { ShareValidator } from './validators/share-validator';

const validator = new ShareValidator(
    1000,    // صعوبة الحوض
    500000000 // صعوبة الشبكة
);

const result = await validator.validateShare(
    {
        workerId: 'worker-001',
        jobId: 'job-abc',
        nonce: 12345678,
        timestamp: Date.now(),
        extraNonce1: 'a1b2c3d4',
        extraNonce2: 'e5f6g7h8'
    },
    currentJob
);

if (result.isBlock) {
    console.log('🎉 كتلة جديدة!');
    // إرسال للشبكة...
} else if (result.isValid) {
    console.log('✅ شير صالح');
}
```

### 4️⃣ المعادلة الرياضية للتحقق

```
┌────────────────────────────────────────────────────────────┐
│                    التحقق من الشير                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. استلم Nonce من ASIC                                    │
│     nonce = 12345678                                       │
│                                                            │
│  2. بناء Block Header                                      │
│     header = version + parents + merkleRoot + ... + nonce  │
│                                                            │
│  3. حساب Hash                                              │
│     hash = kHeavyHash(header)                              │
│     hashBigInt = 0x[hash]                                  │
│                                                            │
│  4. المقارنة:                                              │
│     ┌─────────────────────────────────────────────┐       │
│     │  إذا hashBigInt < poolTarget    → ✅ شير    │       │
│     │  إذا hashBigInt < networkTarget → 🎉 كتلة   │       │
│     │  وإلا                          → ❌ مرفوض   │       │
│     └─────────────────────────────────────────────┘       │
│                                                            │
│  مثال:                                                     │
│  hashBigInt    = 0x0000000abc...                           │
│  poolTarget    = 0x0000ffff...                             │
│  networkTarget = 0x00000000fff...                          │
│                                                            │
│  hashBigInt < poolTarget?    ✅ (شير صالح)                 │
│  hashBigInt < networkTarget? ❌ (ليست كتلة)                │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 🚀 التشغيل

```bash
# 1️⃣ تثبيت التبعيات
cd mining-core
npm install

# 2️⃣ بناء المشروع
npm run build

# 3️⃣ التأكد من تشغيل Kaspa Node
systemctl status kaspad

# 4️⃣ تشغيل الحوض
npm start
```

---

## ✅ التحقق من العمل

### التحقق من العقدة:

```bash
# حالة المزامنة
curl -s http://127.0.0.1:16110/api/v1/info | jq '{
  is_synced: .isSynced,
  network: .networkName,
  connections: .connections
}'

# يجب أن يكون الناتج:
# {
#   "is_synced": true,
#   "network": "kaspa-mainnet",
#   "connections": 125
# }
```

### التحقق من الـ RPC:

```bash
# جلب قالب كتلة
curl -X POST http://127.0.0.1:16110/api/v1/getblocktemplate \
  -H "Content-Type: application/json" \
  -d '{"payAddress": "kaspa:qppxt0expwdg4vra08709ancu4t5stldmc3hdfm4xdschq3whvvqwnr9y7v86"}'
```

---

## 🔧 تحسين الأداء (C++ Native Module)

للأداء العالي، استخدم C++ bindings:

```bash
# تثبيت مكتبة kHeavyHash الأصلية
npm install kheavyhash-native

# أو بناء من المصدر
git clone https://github.com/kaspanet/rust-kaspa
cd rust-kaspa/crypto/hashes
cargo build --release
```

---

## 📊 المراقبة

```bash
# سجلات الحوض
tail -f /var/log/mining-pool/pool.log

# حالة العمال
curl http://localhost:8080/api/stats

# إحصائيات الشبكة
curl http://localhost:8080/api/network
```

---

## 🆘 استكشاف الأخطاء

| المشكلة | الحل |
|---------|------|
| العقدة لا تتزامن | تحقق من فتح المنفذ 16111 |
| RPC غير متاح | تأكد من `--rpclisten` |
| Hash خاطئ | راجع خوارزمية kHeavyHash |
| الشير مرفوض | تحقق من الـ Target |

---

## 📞 الدعم

- **Kaspa Discord**: https://discord.gg/kaspa
- **GitHub Issues**: https://github.com/kaspanet/kaspad/issues
- **Documentation**: https://github.com/kaspanet/docs

---

**تم التطوير بواسطة**: Senior Blockchain Protocol Engineer  
**الإصدار**: 2.0.0 - Production Ready
