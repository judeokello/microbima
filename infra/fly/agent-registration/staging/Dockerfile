FROM node:20-alpine AS base

# Upgrade npm to latest version in base image
RUN npm install -g npm@11.6.2

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/agent-registration/package.json ./apps/agent-registration/
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

# Pass environment variables to the build process
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_INTERNAL_API_BASE_URL
ARG NEXT_PUBLIC_ENABLE_BOOTSTRAP
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT

# Set environment variables for the build
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_INTERNAL_API_BASE_URL=${NEXT_PUBLIC_INTERNAL_API_BASE_URL}
ENV NEXT_PUBLIC_ENABLE_BOOTSTRAP=${NEXT_PUBLIC_ENABLE_BOOTSTRAP}
ENV NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN}
ENV NEXT_PUBLIC_SENTRY_ENVIRONMENT=${NEXT_PUBLIC_SENTRY_ENVIRONMENT}

RUN echo "Build-time environment check:" && \
    echo "NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}" && \
    echo "NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}" && \
    pnpm build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

# NODE_ENV will be set by Fly.io environment variables

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Copy built application from agent-registration
COPY --from=builder /app/apps/agent-registration/.next/standalone ./
COPY --from=builder /app/apps/agent-registration/.next/static ./apps/agent-registration/.next/static
COPY --from=builder /app/apps/agent-registration/public ./apps/agent-registration/public

USER nodejs

EXPOSE 3001

ENV PORT=3001
ENV HOSTNAME="0.0.0.0"

CMD ["node", "apps/agent-registration/server.js"]
