# ==========================================
# ERP Backend - Multi-stage Production Dockerfile
# ==========================================

# --- Stage 1: Build TypeScript ---
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies (clean install)
COPY package*.json ./
RUN npm ci

# Copy TypeScript configuration and source code
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript into dist/
RUN npm run build

# Ensure SQL migration files are bundled into dist/db/migrations
RUN cp -r src/db/migrations dist/db/migrations


# --- Stage 2: Production Runner ---
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled JavaScript and assets from builder stage
COPY --from=builder /app/dist ./dist

# Create persistent upload directories
RUN mkdir -p uploads/documents uploads/lms

# Expose backend API port
EXPOSE 3001

# Declare persistent volume mount point for file uploads
VOLUME ["/app/uploads"]

# Run database migrations automatically against cloud DB, then start the server
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]
