# Staging-optimized Dockerfile for Internal API
FROM node:22-alpine

# Install system dependencies
RUN apk add --no-cache \
    libc6-compat \
    curl \
    && rm -rf /var/cache/apk/*

# Set working directory
WORKDIR /app

# Upgrade npm to latest version
RUN npm install -g npm@11.6.2

# Install pnpm
RUN npm install -g pnpm@10.17.1

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/common-config/package.json ./packages/common-config/
COPY apps/api/package.json ./apps/api/
COPY apps/api/prisma ./apps/api/prisma

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
WORKDIR /app/apps/api
RUN npx prisma generate
RUN pnpm build

# Ensure scripts are executable
RUN chmod +x scripts/*.sh

# Fix pnpm symlinks for production
WORKDIR /app
RUN pnpm install --prod --frozen-lockfile --shamefully-hoist

# NODE_ENV will be set by Fly.io environment variables

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Change ownership of the app directory
RUN chown -R nestjs:nodejs /app

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3001

ENV PORT=3001

# Start the application
CMD ["node", "--enable-source-maps", "apps/api/dist/src/main"]
