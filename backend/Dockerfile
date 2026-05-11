FROM node:20-alpine AS builder

# ==========================================
# Stage 1: Build dependencies
# ==========================================
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Copy the versioned backend manifest. package-lock.json is intentionally
# ignored in this repo, so the image build must not depend on a local lockfile.
COPY package.json ./
RUN npm install --omit=dev

# ==========================================
# Stage 2: Production image
# ==========================================
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy backend production dependencies from builder. Runtime only needs to read
# dependencies, so keep this copy cheap and avoid ownership rewrites over
# node_modules.
COPY --from=builder /app/node_modules ./node_modules

# Copy application code
# Copy backend source
COPY --chown=nodejs:nodejs . .

# Remove unnecessary files that might contain secrets or dev data
RUN rm -f .env .env.local .env.*.local docker-compose.yml Dockerfile.dev

# Ensure runtime writable directories for non-root user. The COPY steps above
# already set ownership for application files and node_modules, so avoid a slow
# recursive chown over the full image filesystem.
RUN install -d -o nodejs -g nodejs logs uploads uploads/attachments

# Switch to non-root user
USER nodejs

EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["npm", "start"]
