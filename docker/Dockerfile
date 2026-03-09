# =====================================================
# 🐳 Dockerfile - Mining Pool Server
# =====================================================
#
# خادم التعدين مع Next.js
#
# @author Senior Blockchain Architect
# =====================================================

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install bun
RUN npm install -g bun

# Copy package files
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# =====================================================
# Stage 2: Builder
# =====================================================
FROM node:20-alpine AS builder
WORKDIR /app

# Install bun
RUN npm install -g bun

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build
RUN bun run build

# =====================================================
# Stage 3: Runner
# =====================================================
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=10000
ENV HOST=0.0.0.0

# Create user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 miner

# Copy built app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy server.js
COPY server.js ./

# Copy package.json for bun
COPY package.json bun.lock ./
RUN npm install -g bun && bun install --production

# Change ownership
RUN chown -R miner:nodejs /app

USER miner

EXPOSE 10000 3333 3334 3336

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:10000/api/health || exit 1

# Start server
CMD ["bun", "run", "server.js"]
