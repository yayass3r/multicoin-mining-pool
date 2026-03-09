# 🚀 دليل النشر على VPS مجاني

## ✅ تم النشر بنجاح!

**الرابط الحي:** https://multicoin-mining-pool.onrender.com

---

## 📊 خيارات VPS مجانية

### 1️⃣ Render.com (مستخدم حالياً) ✅
| الميزة | القيمة |
|--------|--------|
| **السعر** | مجاني للأبد |
| **الرام** | 512 MB |
| **CPU** | 0.1 vCPU |
| **القرص** | لا شيء (يتوقف عند إعادة التشغيل) |
| **المنفذ** | 10000 فقط |

**النشر:**
```bash
# الخدمة تعمل تلقائياً من GitHub
# كل push = نشر تلقائي
```

---

### 2️⃣ Railway.app (الأفضل للـ Stratum)
| الميزة | القيمة |
|--------|--------|
| **السعر** | $5 رصيد مجاني شهرياً |
| **الرام** | 512 MB - 8 GB |
| **CPU** | 1-8 vCPU |
| **القرص** | 1 GB |
| **المنافذ** | متعددة ✅ |

**النشر:**
```bash
# 1. سجل في railway.app
# 2. اربط GitHub
# 3. اختر المشروع
# 4. سيتم النشر تلقائياً
```

---

### 3️⃣ Fly.io (للتعدين الحقيقي)
| الميزة | القيمة |
|--------|--------|
| **السعر** | 3 VMs مجانية |
| **الرام** | 256 MB لكل VM |
| **CPU** | 1 shared vCPU |
| **القرص** | 3 GB |
| **المنافذ** | متعددة ✅ |

**النشر:**
```bash
# تثبيت flyctl
curl -L https://fly.io/install.sh | sh

# تسجيل الدخول
fly auth signup

# النشر
fly launch
fly deploy
```

---

### 4️⃣ Koyeb
| الميزة | القيمة |
|--------|--------|
| **السعر** | Free tier |
| **الرام** | 512 MB |
| **CPU** | 0.5 vCPU |
| **المنافذ** | متعددة |

**النشر:**
```bash
# من لوحة التحكم koyeb.com
# اربط GitHub واختر المشروع
```

---

### 5️⃣ Oracle Cloud (الأفضل للأداء)
| الميزة | القيمة |
|--------|--------|
| **السعر** | Always Free |
| **الرام** | 24 GB (Arm) |
| **CPU** | 4 OCPU |
| **القرص** | 200 GB |
| **المنافذ** | كاملة ✅ |

**التسجيل:** https://cloud.oracle.com

---

## ⛏️ اتصال المعدنين

### من Render.com (مجاني):
```
Dashboard: https://multicoin-mining-pool.onrender.com
API: https://multicoin-mining-pool.onrender.com/api/live-stats
```

⚠️ **ملاحظة:** المنفذ الوحيد المتاح هو 443 (HTTPS)
للـ Stratum، استخدم Railway أو Fly.io

---

### من Railway/Fly.io (Stratum):

**Kaspa (KAS):**
```bash
./ksminer --pool stratum+tcp://YOUR_APP.railway.app:3333 \
  --wallet kaspa:qppxt0expwdg4vra08709ancu4t5stldmc3hdfm4xdschq3whvvqwnr9y7v86 \
  --worker worker1
```

**Ravencoin (RVN):**
```bash
./t-rex -a kawpow \
  -o stratum+tcp://YOUR_APP.railway.app:3334 \
  -u REFRuSaC8iHeKMeUiMg3MEJUKfUD1hmv5Y.worker1 \
  -p x
```

**Alephium (ALPH):**
```bash
./lolMiner -a BLAKE3 \
  -o stratum+tcp://YOUR_APP.railway.app:3336 \
  -u 1DJ5UX4BknPeDcwB9C3EzNGZcF9EBG5UdYAKdeWbDGz5b.worker1 \
  -p x
```

---

## 📊 حالة النظام الآن

```
✅ النظام يعمل على Render.com
✅ التعدين نشط 24/7
✅ Keep-Alive مُفعّل
✅ APIs متاحة
```

---

## 🔄 النشر السريع

### Railway:
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/your-template)

### Fly.io:
[![Deploy on Fly](https://fly.io/static/images/deploy-button.svg)](https://fly.io/launch)

### Render:
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

---

## ⚠️ قيود Free Tier

| المنصة | قيود |
|--------|------|
| Render | يعطل بعد 15 دقيقة عدم نشاط |
| Railway | $5 رصيد فقط شهرياً |
| Fly | 3 VMs فقط |
| Oracle | بطاقة ائتمان مطلوبة |

---

## 💡 نصيحة

**للتعدين الحقيقي:**
1. استخدم Oracle Cloud (24GB RAM مجاناً)
2. أو اشترك في VPS رخيص ($5/شهر)

**للتجربة:**
- Render + Railway معاً يعطيان تغطية جيدة

---

**⛏️ التعدين يعمل 24/7 على Render.com!**
