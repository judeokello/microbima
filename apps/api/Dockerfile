# Use Node.js 22 Alpine as base image
FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/common-config/package.json ./packages/common-config/
COPY apps/api/package.json ./apps/api/

# Install dependencies for all workspaces
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install pnpm
RUN npm install -g pnpm

# Build the application
WORKDIR /app/apps/api
RUN pnpm build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy the built application
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./package.json

# Debug: Check what's in node_modules
RUN echo "=== Root node_modules ==="
RUN ls -la /app/node_modules/ | head -20
RUN echo "=== Apps API node_modules ==="
RUN ls -la /app/apps/api/node_modules/ | head -20
RUN echo "=== Looking for @nestjs/core ==="
RUN find /app -name "@nestjs" -type d 2>/dev/null || echo "No @nestjs found"
RUN find /app -name "core" -path "*/@nestjs/*" 2>/dev/null || echo "No @nestjs/core found"

USER nestjs

EXPOSE 3000

ENV PORT=3000

# Start the application
CMD ["node", "--enable-source-maps", "dist/src/main"]
