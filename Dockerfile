# =============================================================================
# AI GitHub Repository Analyzer — Production Docker Image
# =============================================================================
# Build:
#   docker build -t gh-repo-analyzer .
# Run:
#   docker run -p 3000:3000 --env-file .env gh-repo-analyzer
# =============================================================================

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat git

# ---- Dependencies ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Build ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Production Runner ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Create writable directories at runtime
RUN mkdir -p /app/analysis-results /app/training-data /app/model-checkpoints /app/training-logs /app/.tmp-clone \
  && chown -R nextjs:nodejs /app/analysis-results /app/training-data /app/model-checkpoints /app/training-logs /app/.tmp-clone

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]
