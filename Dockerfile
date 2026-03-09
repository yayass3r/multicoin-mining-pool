# =====================================================
# 🐳 Production Dockerfile - Free Tier Optimized
# =====================================================
# مُحسّن للـ Free Tier على:
# - Render.com
# - Railway.app
# - Fly.io
# - Koyeb
# =====================================================

FROM oven/bun:1 AS base
WORKDIR /app

# =====================================================
# Stage 1: Install dependencies
# =====================================================
FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# =====================================================
# Stage 2: Build
# =====================================================
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN bun run build

# =====================================================
# Stage 3: Runner
# =====================================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=10000
ENV HOST=0.0.0.0

# إنشاء مستخدم غير root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 miner

# نسخ الملفات المطلوبة
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY server.js ./

# تغيير الملكية
RUN chown -R miner:nodejs /app

USER miner

EXPOSE 10000 3333 3334 3336

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:10000/api/health || exit 1

# Start
CMD ["bun", "run", "server.js"]
