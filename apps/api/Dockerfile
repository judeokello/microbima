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

# Install dependencies
RUN pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install pnpm
RUN npm install -g pnpm

# Build the application
RUN pnpm build

# Debug: List contents to see what was built
RUN ls -la /app/apps/api/
RUN ls -la /app/apps/api/dist/ || echo "dist directory not found"

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs

# Copy the built application
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./package.json

USER nestjs

EXPOSE 3000

ENV PORT=3000

# Start the application
CMD ["node", "--enable-source-maps", "dist/src/main"]
