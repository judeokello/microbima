FROM kong:3.4-alpine

# Install additional security tools
RUN apk add --no-cache dumb-init curl

# Copy Kong configuration
COPY kong.yml /etc/kong/kong.yml

# Set Kong to use declarative configuration
ENV KONG_DATABASE=off
ENV KONG_DECLARATIVE_CONFIG=/etc/kong/kong.yml

# Expose Kong ports
EXPOSE 8000 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD kong health || exit 1

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start Kong
CMD ["kong", "docker-start"]
