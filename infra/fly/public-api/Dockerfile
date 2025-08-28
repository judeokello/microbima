FROM kong:3.4-alpine

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

# Start Kong
CMD ["kong", "docker-start"]
