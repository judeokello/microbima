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

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=nestjs:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=nestjs:nodejs /app/packages/common-config/package.json ./packages/common-config/package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./apps/api/package.json

# Install all dependencies (including dev dependencies for now)
RUN pnpm install --frozen-lockfile

# Copy the built application
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist

USER nestjs

EXPOSE 3000

ENV PORT=3000

# Start the application
CMD ["node", "--enable-source-maps", "dist/src/main"]
