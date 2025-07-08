# Multi-stage Docker build for Nosana Agent Challenge
# Stage 1: Build the Mastra backend
FROM node:20-alpine AS backend-builder

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Build the Mastra application
RUN pnpm run build

# Stage 2: Production
FROM node:20-alpine AS production

# Install pnpm and http-server
RUN npm install -g pnpm http-server

# Create app directory
WORKDIR /app

# Copy built Mastra application from builder stage
COPY --from=backend-builder /app/.mastra/output ./

# Copy frontend static files
COPY front/ ./frontend/

# Copy .env file if it exists (for local development)
COPY .env* ./

# Install only production dependencies for the backend
RUN pnpm install --prod --frozen-lockfile

# Accept build args (don't store in ENV during build)
ARG GOOGLE_GENERATIVE_AI_API_KEY

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose ports
EXPOSE 3000 8080

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "const http = require('http'); \
               const req = http.request({hostname:'localhost',port:8080,path:'/',timeout:5000}, \
               (res) => process.exit(res.statusCode < 400 ? 0 : 1)); \
               req.on('error', () => process.exit(1)); \
               req.end();"

# Start both backend and frontend
CMD ["sh", "-c", "node --import=./instrumentation.mjs ./index.mjs & http-server ./frontend -p 3000 --cors -c-1 && wait"]