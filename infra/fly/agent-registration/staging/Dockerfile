FROM node:18-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json pnpm-lock.yaml* ./
RUN npm install -g pnpm@10.17.1 && pnpm install --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install pnpm in builder stage
RUN npm install -g pnpm@10.17.1

# Build the agent registration app
WORKDIR /app/apps/agent-registration
RUN pnpm build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

# NODE_ENV will be set by Fly.io environment variables

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built application from agent-registration
COPY --from=builder /app/apps/agent-registration/.next/standalone ./
COPY --from=builder /app/apps/agent-registration/.next/static ./.next/static
COPY --from=builder /app/apps/agent-registration/public ./public

USER nodejs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
