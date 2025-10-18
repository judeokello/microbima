FROM kong:3.4

# Kong uses Ubuntu, not Alpine
# Install additional security tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    dumb-init \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Kong configuration from the correct path
COPY infra/fly/public-api/staging/kong.yml /etc/kong/kong.yml

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
