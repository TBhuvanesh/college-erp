# ==============================================================================
# Frontend Dockerfile - College ERP (Next.js 16 / React 19 / TypeScript)
# Multi-stage production build using Next.js Standalone Output
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Dependencies
# ------------------------------------------------------------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Install dependencies using lockfile
COPY package.json package-lock.json ./
RUN npm ci

# ------------------------------------------------------------------------------
# Stage 2: Builder
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy cached dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./

# Copy source configuration and code
COPY next.config.ts tsconfig.json postcss.config.mjs eslint.config.mjs ./
COPY public ./public
COPY src ./src

# Set build-time environment arguments (baked into client-side JS bundles)
ARG NEXT_PUBLIC_API_URL="http://localhost:3001/api"
ARG NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build Next.js application with standalone output
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Production Runner
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Create non-root system user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy static assets and standalone server bundle
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
