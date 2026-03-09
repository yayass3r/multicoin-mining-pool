# =====================================================
# Dockerfile لخادم Stratum
# Multi-Coin Mining Pool Stratum Server
# =====================================================

FROM node:20-alpine AS builder

WORKDIR /app

# تثبيت الاعتماديات
COPY package*.json ./
RUN npm ci --only=production

# نسخ الملفات المصدرية
COPY . .

# بناء TypeScript
RUN npm run build

# =====================================================
# صورة الإنتاج
# =====================================================
FROM node:20-alpine

WORKDIR /app

# تثبيت الأدوات الضرورية
RUN apk add --no-cache \
    curl \
    dumb-init

# إنشاء مستخدم غير root
RUN addgroup -g 1000 pool && \
    adduser -u 1000 -G pool -s /bin/sh -D pool

# نسخ الملفات من مرحلة البناء
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# إنشاء مجلدات السجلات
RUN mkdir -p /app/logs && chown -R pool:pool /app

# التبديل للمستخدم pool
USER pool

# المنافذ
EXPOSE 3333 3334 3335 3336 8080

# فحص الصحة
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# نقطة الدخول
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/pool/MultiCoinPoolManager.js"]
