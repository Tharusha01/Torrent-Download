# =============================================================================
# Torrent Downloader - Dockerfile
# Multi-stage build for optimized production image
# =============================================================================

# Stage 1: Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev)
RUN npm ci --only=production

# Stage 2: Production stage
FROM node:20-alpine AS production

# Add labels for better maintainability
LABEL maintainer="Tharusha"
LABEL description="Web application to download torrents via magnet links"
LABEL version="1.0.0"

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S torrent -u 1001 -G nodejs

WORKDIR /app

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application files
COPY --chown=torrent:nodejs package*.json ./
COPY --chown=torrent:nodejs server.js ./
COPY --chown=torrent:nodejs public ./public

# Create downloads directory with proper permissions
RUN mkdir -p /app/downloads && \
    chown -R torrent:nodejs /app/downloads

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose the port
EXPOSE 3000

# Create volume for downloads
VOLUME ["/app/downloads"]

# Switch to non-root user
USER torrent

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start the application
CMD ["node", "server.js"]
