# Use Node.js 22 Alpine as base image
FROM node:22-alpine

# Install system dependencies
RUN apk add --no-cache libc6-compat

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/common-config/package.json ./packages/common-config/
COPY apps/api/package.json ./apps/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
WORKDIR /app/apps/api
RUN npx prisma generate
RUN pnpm build

# Fix pnpm symlinks for production
# pnpm creates symlinks that don't work well in Docker, so we need to resolve them
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
EXPOSE 3000

ENV PORT=3000

# Start the application
CMD ["node", "--enable-source-maps", "apps/api/dist/src/main"]
