# ==============================================================================
# Backend Dockerfile - College ERP (Node.js / Express / TypeScript)
# Multi-stage production build
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Builder
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies using lockfile
COPY package.json package-lock.json ./
RUN npm ci

# Copy TypeScript configuration and source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript to dist
RUN npm run build

# Copy database SQL migrations into the dist directory for the migration runner
RUN cp -r src/db/migrations dist/db/migrations

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

# Copy dependency definitions and install production-only dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled JavaScript output and migrations from builder
COPY --from=builder /app/dist ./dist

# Create uploads directory structure and set correct permissions
RUN mkdir -p uploads/documents uploads/lms && chown -R node:node /app

# Switch to standard non-root node user
USER node

# Expose backend API port
EXPOSE 3001

# Run database migrations automatically before starting Express server
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]
