# ==========================================
# Stage 1: Build dependencies
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy backend manifests (this Dockerfile is built with backend/ as context root)
COPY package*.json ./
RUN if [ -f package-lock.json ]; then \
      npm ci --only=production; \
    else \
      npm install --only=production; \
    fi

# ==========================================
# Stage 2: Production image
# ==========================================
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy backend production dependencies from builder
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copy application code
# Copy backend source
COPY --chown=nodejs:nodejs . .

# Remove unnecessary files that might contain secrets or dev data
RUN rm -f .env .env.local .env.*.local docker-compose.yml Dockerfile.dev

# Ensure runtime writable directories for non-root user
RUN mkdir -p logs uploads uploads/attachments && chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "start"]
