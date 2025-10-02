# Build stage
FROM golang:1.25 AS builder

WORKDIR /build

# Copy all source code (go mod download will happen during build)
COPY . .

# Build static binary with optimizations
RUN CGO_ENABLED=0 go build \
    -ldflags="-s -w -X main.version=${VERSION:-dev}" \
    -o hydreq \
    ./cmd/hydreq

# Runtime stage - using Alpine for minimal size with shell support
FROM alpine:3.21

# Copy CA certificates from builder
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/

# Create non-root user
RUN addgroup -g 1000 hydreq && \
    adduser -D -u 1000 -G hydreq hydreq

WORKDIR /app

# Copy binary from builder
COPY --from=builder /build/hydreq /app/hydreq

# Change ownership
RUN chown -R hydreq:hydreq /app

# Switch to non-root user
USER hydreq

# Expose default GUI port
EXPOSE 8787

# Default command starts GUI
ENTRYPOINT ["/app/hydreq"]
CMD ["gui"]
